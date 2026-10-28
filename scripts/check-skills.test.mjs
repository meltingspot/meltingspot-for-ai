// Tests of check-skills.mjs, each on a temporary plugin fixture. They cover
// the rows of the I/O matrix of the spec (kept in the monorepo spec), plus the
// edge cases of the parser and the manifest checks.
// Run with `node --test "scripts/**/*.test.mjs"`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./check-skills.mjs', import.meta.url));

const tool = (name, domain, status = 'delivered', readOnly = false, destructive = false) => ({
  name,
  domain,
  status,
  readOnly,
  destructive,
});

const TOOLS = [
  tool('group_create', 'group'),
  tool('group_list', 'group', 'delivered', true),
  tool('topic_list', 'topic', 'upcoming', true),
];

// Valid manifests: every fixture gets them unless a test overrides one
const MANIFESTS = {
  '.claude-plugin/plugin.json': { name: 'meltingspot', version: '0.1.0' },
  '.codex-plugin/plugin.json': {
    name: 'meltingspot',
    version: '0.1.0',
    skills: './skills/',
    mcpServers: './.mcp.json',
    interface: { logo: './assets/logo.svg', composerIcon: './assets/logo.svg' },
  },
  '.claude-plugin/marketplace.json': { name: 'meltingspot', plugins: [{ name: 'meltingspot', source: './' }] },
  '.agents/plugins/marketplace.json': {
    name: 'meltingspot',
    plugins: [{ name: 'meltingspot', source: { source: 'local', path: './' } }],
  },
  '.mcp.json': { mcpServers: { meltingspot: { type: 'http', url: 'https://mcp.example.test/mcp' } } },
  'mcp.json': {
    mcpServers: { meltingspot: { type: 'streamable-http', url: 'https://mcp.example.test/mcp' } },
  },
  'CHANGELOG.md': '# Changelog\n\n## 0.1.0 - 2026-10-28\n\n- First release.\n',
  'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
};

const skill = ({ name, description = 'Load it when testing the checks.', body = '' }) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# Skill\n\n${body}\n`;

// The body of skill() starts on line 8
const BODY_LINE = 8;

const DEFAULT_SKILLS = {
  'meltingspot-groups/SKILL.md': skill({ name: 'meltingspot-groups' }),
};

const fixtures = [];

const write = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(
    join(root, path),
    typeof content === 'string' ? content : JSON.stringify(content, null, 2),
  );
};

/**
 * Writes a plugin root: tools.json, the manifests and the skills, given as
 * { 'dir/SKILL.md': content } (a null content creates an empty folder).
 * `files` overrides or adds any file; a null value leaves the file out.
 */
const createFixture = ({ tools = TOOLS, skills = DEFAULT_SKILLS, files = {} } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'check-skills-'));
  fixtures.push(root);
  write(root, 'tools.json', typeof tools === 'string' ? tools : { tools });
  for (const [path, content] of Object.entries({ ...MANIFESTS, ...files })) {
    if (content !== null) {
      write(root, path, content);
    }
  }
  if (skills !== null) {
    mkdirSync(join(root, 'skills'), { recursive: true });
    for (const [path, content] of Object.entries(skills)) {
      if (content === null) {
        mkdirSync(join(root, 'skills', path), { recursive: true });
      } else {
        write(root, join('skills', path), content);
      }
    }
  }
  return root;
};

const check = (...args) => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
  });
  return { status, stdout, stderr };
};

const assertFails = (root, expected) => {
  const { status, stderr } = check('--root', root);
  assert.equal(status, 1, stderr);
  for (const pattern of [expected].flat()) {
    assert.match(stderr, pattern);
  }
  return stderr;
};

const assertPasses = (root) => {
  const result = check('--root', root);
  assert.equal(result.status, 0, result.stderr);
  return result;
};

afterEach(() => {
  while (fixtures.length > 0) {
    rmSync(fixtures.pop(), { recursive: true, force: true });
  }
});

describe('check-skills', () => {
  describe('tool references', () => {
    it('passes when a skill cites a known tool', () => {
      assertPasses(
        createFixture({
          skills: {
            'meltingspot-groups/SKILL.md': skill({
              name: 'meltingspot-groups',
              body: 'Create it with `group_create`.',
            }),
          },
        }),
      );
    });

    it('fails with the file, the line and the name when a skill cites an unknown tool', () => {
      const root = createFixture({
        skills: {
          'meltingspot-groups/SKILL.md': skill({
            name: 'meltingspot-groups',
            body: 'Archive it with `group_archive`.',
          }),
        },
      });

      const stderr = assertFails(
        root,
        new RegExp(`skills/meltingspot-groups/SKILL\\.md:${BODY_LINE}: unknown tool "group_archive"`),
      );
      assert.match(stderr, /1 problem\(s\) found\./);
    });

    it('checks every Markdown file of a skill, each span of a line', () => {
      const root = createFixture({
        skills: {
          ...DEFAULT_SKILLS,
          'meltingspot-groups/references/x.md': '# Ref\n\nUse `group_create`, not `group_archive`.\n',
        },
      });

      const stderr = assertFails(
        root,
        /skills\/meltingspot-groups\/references\/x\.md:3: unknown tool "group_archive"/,
      );
      assert.doesNotMatch(stderr, /"group_create"/);
    });

    it('ignores spans outside the domains, bare prefixes and spans that are not identifiers', () => {
      assertPasses(
        createFixture({
          skills: {
            'meltingspot-groups/SKILL.md': skill({
              name: 'meltingspot-groups',
              body: 'Read `member_list`, `groupId`, `group_`, `group_archive()` and `{ deleted: true }`.',
            }),
          },
        }),
      );
    });
  });

  describe('frontmatter', () => {
    const invalid = [
      {
        rule: 'name different from the folder',
        dir: 'meltingspot-groups',
        content: skill({ name: 'meltingspot-tags' }),
        expected: /SKILL\.md: "name" \(meltingspot-tags\) must equal the folder name \(meltingspot-groups\)/,
      },
      {
        rule: 'name of 65 characters',
        dir: `meltingspot-${'a'.repeat(53)}`,
        content: skill({ name: `meltingspot-${'a'.repeat(53)}` }),
        expected: /SKILL\.md: "name" must be 64 characters at most \(65\)/,
      },
      {
        rule: 'name without the meltingspot- prefix',
        dir: 'groups',
        content: skill({ name: 'groups' }),
        expected: /SKILL\.md: "name" must start with "meltingspot-"/,
      },
      {
        rule: 'name not in kebab-case, prefix kept',
        dir: 'meltingspot-Groups_x',
        content: skill({ name: 'meltingspot-Groups_x' }),
        expected: /SKILL\.md: "name" must be kebab-case/,
      },
      {
        rule: 'missing name',
        dir: 'meltingspot-groups',
        content: '---\ndescription: Load it when testing.\n---\n',
        expected: /SKILL\.md: "name" is missing/,
      },
      {
        rule: 'missing description',
        dir: 'meltingspot-groups',
        content: '---\nname: meltingspot-groups\n---\n\n# Skill\n',
        expected: /SKILL\.md: "description" is missing/,
      },
      {
        rule: 'description of 1025 characters',
        dir: 'meltingspot-groups',
        content: skill({ name: 'meltingspot-groups', description: 'a'.repeat(1025) }),
        expected: /SKILL\.md: "description" must be 1024 characters at most \(1025\)/,
      },
      {
        rule: 'folded description longer than 1024 characters, measured exactly',
        dir: 'meltingspot-groups',
        // Two lines of 600 characters folded with one space: 1201
        content: `---\nname: meltingspot-groups\ndescription: >-\n  ${'a'.repeat(600)}\n  ${'b'.repeat(600)}\n---\n`,
        expected: /SKILL\.md: "description" must be 1024 characters at most \(1201\)/,
      },
      {
        rule: 'missing frontmatter',
        dir: 'meltingspot-groups',
        content: '# Skill\n',
        expected: /SKILL\.md: missing or unterminated YAML frontmatter/,
      },
      {
        rule: 'unterminated frontmatter',
        dir: 'meltingspot-groups',
        content: '---\nname: meltingspot-groups\ndescription: x\n',
        expected: /SKILL\.md: missing or unterminated YAML frontmatter/,
      },
      {
        rule: 'unsupported YAML reported, not mis-measured',
        dir: 'meltingspot-groups',
        content: '---\nname: meltingspot-groups\ndescription: [a, b]\n---\n',
        expected: /SKILL\.md: "description" uses unsupported YAML/,
      },
    ];

    for (const { rule, dir, content, expected } of invalid) {
      it(`fails on ${rule}, naming the file`, () => {
        const root = createFixture({ skills: { [`${dir}/SKILL.md`]: content } });

        assertFails(root, [new RegExp(`skills/${dir}/SKILL\\.md`), expected]);
      });
    }

    const valid = [
      {
        rule: 'a name of exactly 64 characters',
        dir: `meltingspot-${'a'.repeat(52)}`,
        content: skill({ name: `meltingspot-${'a'.repeat(52)}` }),
      },
      {
        rule: 'a description of exactly 1024 characters',
        dir: 'meltingspot-groups',
        content: skill({ name: 'meltingspot-groups', description: 'a'.repeat(1024) }),
      },
      {
        rule: 'a literal block description',
        dir: 'meltingspot-groups',
        content: '---\nname: meltingspot-groups\ndescription: |\n  First line.\n  Second line.\n---\n',
      },
      {
        rule: 'a plain multi-line description',
        dir: 'meltingspot-groups',
        content: '---\nname: meltingspot-groups\ndescription: Load it\n  when testing.\n---\n',
      },
      {
        rule: 'quoted values with escapes',
        dir: 'meltingspot-groups',
        content: `---\nname: "meltingspot-groups"\ndescription: 'It''s for \\"tests\\".'\n---\n`,
      },
      {
        rule: 'a BOM, CRLF and trailing spaces on the delimiters',
        dir: 'meltingspot-groups',
        content: '\uFEFF--- \r\nname: meltingspot-groups\r\ndescription: Load it.\r\n---  \r\n',
      },
      {
        rule: 'a nested metadata mapping',
        dir: 'meltingspot-groups',
        content: '---\nname: meltingspot-groups\ndescription: Load it.\nmetadata:\n  author: MeltingSpot\n---\n',
      },
    ];

    for (const { rule, dir, content } of valid) {
      it(`accepts ${rule}`, () => {
        assertPasses(createFixture({ skills: { [`${dir}/SKILL.md`]: content } }));
      });
    }

    it('fails on a skill folder without SKILL.md', () => {
      const root = createFixture({ skills: { ...DEFAULT_SKILLS, 'meltingspot-empty': null } });

      assertFails(root, /skills\/meltingspot-empty\/SKILL\.md: missing SKILL\.md/);
    });

    it('fails when there is no skill directory', () => {
      assertFails(createFixture({ skills: {} }), /skills: no skill directory found/);
    });

    it('fails when the skills folder is missing', () => {
      assertFails(createFixture({ skills: null }), /skills: cannot be read/);
    });
  });

  describe('tools.json', () => {
    const invalid = [
      ['a duplicate tool name', [TOOLS[0], TOOLS[0]], /duplicate tool name "group_create"/],
      [
        'a status outside delivered and upcoming',
        [{ ...TOOLS[0], status: 'planned' }],
        /"status" must be one of delivered, upcoming/,
      ],
      ['unsorted tools', [TOOLS[1], TOOLS[0]], /tools must be sorted by name \("group_list" at index 0\)/],
      [
        'a name without its domain prefix',
        [tool('tag_create', 'group')],
        /\(tag_create\): "name" must start with its domain "group_"/,
      ],
      ['a name not in snake_case', [tool('group-Create', 'group')], /"name" must be a snake_case string/],
      [
        'a non-boolean readOnly or destructive',
        [{ ...TOOLS[0], readOnly: 'no', destructive: 1 }],
        [/"readOnly" must be a boolean/, /"destructive" must be a boolean/],
      ],
      [
        'a tool both readOnly and destructive',
        [tool('group_delete', 'group', 'delivered', true, true)],
        /cannot be both "readOnly" and "destructive"/,
      ],
    ];

    for (const [rule, tools, expected] of invalid) {
      it(`fails on ${rule}`, () => {
        assertFails(createFixture({ tools }), expected);
      });
    }

    it('reports entries without a name or domain without spurious messages', () => {
      const stderr = assertFails(
        createFixture({
          tools: [
            { domain: { x: 1 }, status: 'delivered', readOnly: true, destructive: false },
            { status: 'delivered', readOnly: true, destructive: false },
          ],
        }),
        /"name" must be a snake_case string/,
      );
      assert.doesNotMatch(stderr, /duplicate|\[object Object\]|undefined/);
    });

    it('fails when "tools" is not an array', () => {
      assertFails(createFixture({ tools: '{ "tools": {} }' }), /tools\.json: "tools" must be an array/);
    });

    it('fails on an unparsable file', () => {
      assertFails(createFixture({ tools: '{ not json' }), /tools\.json: invalid JSON/);
    });
  });

  describe('manifests', () => {
    it('fails on a version mismatch between the manifests and the CHANGELOG', () => {
      const root = createFixture({
        files: { 'CHANGELOG.md': '# Changelog\n\n## 0.2.0 - 2026-11-01\n\n## 0.1.0\n' },
      });

      assertFails(root, /version mismatch: .*CHANGELOG\.md 0\.2\.0/);
    });

    it('fails on an MCP URL mismatch', () => {
      const root = createFixture({
        files: {
          'mcp.json': { mcpServers: { meltingspot: { type: 'streamable-http', url: 'https://other.test/mcp' } } },
        },
      });

      assertFails(root, /MCP URL mismatch/);
    });

    it('fails when the MCP server is not named meltingspot', () => {
      const root = createFixture({
        files: { '.mcp.json': { mcpServers: { other: { type: 'http', url: 'https://mcp.example.test/mcp' } } } },
      });

      assertFails(root, /\.mcp\.json: no "url" for the server "meltingspot"/);
    });

    it('fails on a missing referenced path', () => {
      const root = createFixture({ files: { 'assets/logo.svg': null } });

      assertFails(root, /\.codex-plugin\/plugin\.json: "interface\.logo" \(\.\/assets\/logo\.svg\) does not exist/);
    });

    it('fails on a marketplace source outside the plugin', () => {
      const root = createFixture({
        files: { '.claude-plugin/marketplace.json': { name: 'meltingspot', plugins: [{ source: '../x' }] } },
      });

      assertFails(root, /plugins\[0\]\.source" \(\.\.\/x\) must stay inside the plugin/);
    });
  });

  describe('summary', () => {
    it('prints the counts and "none" when no upcoming tool is cited', () => {
      const { stdout } = assertPasses(createFixture());

      assert.match(stdout, /Tools: 2 delivered, 1 upcoming\./);
      assert.match(stdout, /Upcoming tools cited by the skills: none\./);
    });

    it('lists an upcoming tool cited twice with its locations', () => {
      const root = createFixture({
        skills: {
          'meltingspot-groups/SKILL.md': skill({
            name: 'meltingspot-groups',
            body: 'List topics with `topic_list`.\n\nAgain: `topic_list`.',
          }),
        },
      });

      const { stdout } = assertPasses(root);

      assert.match(
        stdout,
        new RegExp(
          `topic_list \\(skills/meltingspot-groups/SKILL\\.md:${BODY_LINE}, skills/meltingspot-groups/SKILL\\.md:${BODY_LINE + 2}\\)`,
        ),
      );
    });
  });

  describe('arguments', () => {
    it('exits with 2 and a clear message when --root has no value', () => {
      const { status, stderr } = check('--root');

      assert.equal(status, 2);
      assert.match(stderr, /--root requires a directory/);
      assert.doesNotMatch(stderr, /TypeError|\n\s+at /);
    });

    it('accepts --root=<dir>', () => {
      const root = createFixture();

      assert.equal(check(`--root=${root}`).status, 0);
    });
  });

  it('passes on the real plugin root', () => {
    const { status, stdout, stderr } = check();

    assert.equal(status, 0, stderr);
    assert.match(stdout, /Tools: 62 delivered, 38 upcoming\./);
  });
});
