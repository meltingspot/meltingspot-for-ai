#!/usr/bin/env node
// Checks the skills and the manifests of the plugin against tools.json.
// Node >= 22, no dependency.
// Usage: node scripts/check-skills.mjs [--root <dir> | --root=<dir>]
// Exit codes: 0 when everything is valid, 1 when problems are found, 2 on a
// usage error.
//
// Each check is a function (context) => problems[], grouped in TOOLS_CHECKS,
// SKILL_CHECKS and MANIFEST_CHECKS. To add a rule, append a function to the
// matching array.

import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL_STATUSES = ['delivered', 'upcoming'];
export const SKILL_NAME_PREFIX = 'meltingspot-';
export const SKILL_NAME_MAX_LENGTH = 64;
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024;
export const MCP_SERVER_NAME = 'meltingspot';

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TOOL_NAME = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
// Content of an inline code span, taken pairwise on a line
const INLINE_CODE_SPAN = /`([^`]+)`/g;
// Block scalar header: `>` or `|`, then an optional chomping indicator and an
// optional indentation indicator, in any order (`>-`, `|+`, `>2`, `|2-`)
const BLOCK_SCALAR = /^([>|])([+-]?[1-9]?|[1-9][+-])$/;

// --- File system, never throwing ---------------------------------------------

const tryRead = (path) => {
  try {
    return { value: readFileSync(path, 'utf8') };
  } catch (error) {
    return { error: error.message };
  }
};

const tryReadDir = (path) => {
  try {
    return { value: readdirSync(path).sort() };
  } catch (error) {
    return { error: error.message };
  }
};

const tryLstat = (path) => {
  try {
    return { value: lstatSync(path) };
  } catch (error) {
    return { error: error.message };
  }
};

const tryReadJson = (root, file) => {
  const { value, error } = tryRead(join(root, file));
  if (error) {
    return { problem: `${file}: cannot be read (${error})` };
  }
  try {
    return { value: JSON.parse(value) };
  } catch (parseError) {
    return { problem: `${file}: invalid JSON (${parseError.message})` };
  }
};

// --- Loading -----------------------------------------------------------------

/**
 * Reads tools.json. Returns { tools, problems }: a file that cannot be read or
 * parsed is a problem, not an exception.
 */
export const loadTools = (root) => {
  const { value, problem } = tryReadJson(root, 'tools.json');
  if (problem) {
    return { tools: [], problems: [problem] };
  }
  if (!value || !Array.isArray(value.tools)) {
    return { tools: [], problems: ['tools.json: "tools" must be an array'] };
  }

  return { tools: value.tools, problems: [] };
};

const unquote = (raw) => {
  if (raw.startsWith("'")) {
    if (raw.length < 2 || !raw.endsWith("'")) {
      return { unsupported: 'multi-line or unterminated single-quoted value' };
    }
    return { value: raw.slice(1, -1).replace(/''/g, "'") };
  }
  if (raw.startsWith('"')) {
    if (raw.length < 2 || !/[^\\]"$|^""$/.test(raw)) {
      return { unsupported: 'multi-line or unterminated double-quoted value' };
    }
    const escapes = { n: '\n', t: '\t', '"': '"', '\\': '\\', '/': '/' };
    return {
      value: raw
        .slice(1, -1)
        .replace(/\\(.)/g, (match, char) => escapes[char] ?? match),
    };
  }
  if (/^[[{&*!%@`]/.test(raw)) {
    return { unsupported: `value starting with "${raw[0]}"` };
  }
  // A plain scalar ends at a comment
  return { value: raw.replace(/\s+#.*$/, '') };
};

const indentOf = (line) => line.match(/^ */)[0].length;

/**
 * Parses the YAML frontmatter of a SKILL.md, enough for the top-level scalar
 * fields (name, description) without a YAML dependency: plain values, also
 * continued on indented lines, quoted values, and `>` / `|` block scalars.
 * Returns null when there is no frontmatter, or { fields, unsupported } where
 * `unsupported` maps a field to the YAML feature that could not be read.
 * Nested mappings (`metadata:`) are skipped. Trailing line breaks of a block
 * scalar are not kept: lengths are measured on the text.
 */
export const parseFrontmatter = (content) => {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  if (lines[0] !== '---') {
    return null;
  }
  const end = lines.indexOf('---', 1);
  if (end === -1) {
    return null;
  }

  const fields = {};
  const unsupported = {};
  let index = 1;
  while (index < end) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):(?:\s+(.*))?$/);
    index += 1;
    if (!match) {
      continue;
    }
    const key = match[1];
    const raw = (match[2] ?? '').trim();

    // The indented lines that follow belong to this key
    const block = [];
    while (index < end && (lines[index] === '' || indentOf(lines[index]) > 0)) {
      block.push(lines[index]);
      index += 1;
    }
    while (block.length > 0 && block[block.length - 1] === '') {
      block.pop();
    }

    const blockScalar = raw.match(BLOCK_SCALAR);
    if (blockScalar) {
      const explicitIndent = Number(raw.replace(/\D/g, '')) || null;
      const firstLine = block.find((line) => line !== '');
      const indent = explicitIndent ?? (firstLine ? indentOf(firstLine) : 0);
      const body = block.map((line) => line.slice(indent));
      fields[key] =
        blockScalar[1] === '|'
          ? body.join('\n')
          : // Folded: lines join with a space, an empty line is a line break
            body
              .join('\n')
              .split(/\n{2,}/)
              .map((paragraph) => paragraph.split('\n').join(' '))
              .join('\n');
      continue;
    }

    if (raw === '' && block.some((line) => /^\s+[A-Za-z0-9_-]+:(\s|$)/.test(line))) {
      // Nested mapping: not a scalar field
      continue;
    }

    if (block.length > 0) {
      // Plain multi-line scalar: continuation lines join with a space
      if (/^['"]/.test(raw)) {
        unsupported[key] = 'multi-line quoted value';
        continue;
      }
      fields[key] = [raw, ...block.map((line) => line.trim())]
        .filter((part) => part !== '')
        .join(' ');
      continue;
    }

    const { value, unsupported: reason } = unquote(raw);
    if (reason) {
      unsupported[key] = reason;
    } else {
      fields[key] = value.trim();
    }
  }

  return { fields, unsupported };
};

/** Lists the Markdown files under a directory, skipping symbolic links. */
const listMarkdownFiles = (root, dir) => {
  const entries = tryReadDir(dir);
  if (entries.error) {
    return { files: [], problems: [`${relative(root, dir)}: cannot be read (${entries.error})`] };
  }
  const files = [];
  const problems = [];
  for (const entry of entries.value) {
    const path = join(dir, entry);
    const stat = tryLstat(path);
    if (stat.error) {
      problems.push(`${relative(root, path)}: cannot be read (${stat.error})`);
    } else if (stat.value.isSymbolicLink()) {
      // Skipped: a link could loop or leave the plugin
    } else if (stat.value.isDirectory()) {
      const nested = listMarkdownFiles(root, path);
      files.push(...nested.files);
      problems.push(...nested.problems);
    } else if (entry.endsWith('.md')) {
      const read = tryRead(path);
      if (read.error) {
        problems.push(`${relative(root, path)}: cannot be read (${read.error})`);
      } else {
        files.push({ file: relative(root, path), content: read.value });
      }
    }
  }
  return { files, problems };
};

/**
 * Lists the skills: every directory of `skills/` (symbolic links skipped),
 * with its SKILL.md and all its Markdown files. Returns { skills, problems }.
 */
export const loadSkills = (root) => {
  const skillsDir = join(root, 'skills');
  const entries = tryReadDir(skillsDir);
  if (entries.error) {
    return { skills: [], problems: [`skills: cannot be read (${entries.error})`] };
  }

  const skills = [];
  const problems = [];
  for (const dir of entries.value) {
    const stat = tryLstat(join(skillsDir, dir));
    if (stat.error) {
      problems.push(`skills/${dir}: cannot be read (${stat.error})`);
      continue;
    }
    if (stat.value.isSymbolicLink() || !stat.value.isDirectory()) {
      continue;
    }
    const markdown = listMarkdownFiles(root, join(skillsDir, dir));
    problems.push(...markdown.problems);
    const file = join('skills', dir, 'SKILL.md');
    skills.push({
      dir,
      file,
      content: markdown.files.find((entry) => entry.file === file)?.content ?? null,
      markdownFiles: markdown.files,
    });
  }
  if (skills.length === 0) {
    problems.push('skills: no skill directory found');
  }

  return { skills, problems };
};

/**
 * Finds the tool references of a Markdown file: an inline code span whose
 * whole content is an identifier that starts with the prefix of a domain of
 * tools.json (`group_create`). A bare prefix (`group_`) is not a reference.
 */
export const findToolReferences = (content, domains) => {
  const prefixes = [...domains].map((domain) => `${domain}_`);
  return content.split(/\r?\n/).flatMap((text, index) =>
    [...text.matchAll(INLINE_CODE_SPAN)]
      .map((match) => match[1])
      .filter(
        (span) =>
          /^[a-z][a-z0-9_]*$/.test(span) &&
          prefixes.some((prefix) => span.startsWith(prefix) && span.length > prefix.length),
      )
      .map((name) => ({ name, line: index + 1 })),
  );
};

// --- Checks of tools.json ----------------------------------------------------

export const checkToolEntries = ({ tools }) =>
  tools.flatMap((tool, index) => {
    const hasName = typeof tool?.name === 'string';
    const hasDomain = typeof tool?.domain === 'string' && tool.domain !== '';
    const at = `tools.json: tools[${index}]${hasName ? ` (${tool.name})` : ''}`;
    const problems = [];
    if (!hasName || !TOOL_NAME.test(tool.name)) {
      problems.push(`${at}: "name" must be a snake_case string`);
    }
    if (!hasDomain) {
      problems.push(`${at}: "domain" must be a non-empty string`);
    } else if (hasName && !tool.name.startsWith(`${tool.domain}_`)) {
      problems.push(`${at}: "name" must start with its domain "${tool.domain}_"`);
    }
    if (!TOOL_STATUSES.includes(tool?.status)) {
      problems.push(`${at}: "status" must be one of ${TOOL_STATUSES.join(', ')}`);
    }
    for (const flag of ['readOnly', 'destructive']) {
      if (typeof tool?.[flag] !== 'boolean') {
        problems.push(`${at}: "${flag}" must be a boolean`);
      }
    }
    if (tool?.readOnly === true && tool?.destructive === true) {
      problems.push(`${at}: a tool cannot be both "readOnly" and "destructive"`);
    }
    return problems;
  });

export const checkToolDuplicates = ({ tools }) => {
  const seen = new Set();
  const problems = [];
  for (const tool of tools) {
    if (typeof tool?.name !== 'string') {
      continue;
    }
    if (seen.has(tool.name)) {
      problems.push(`tools.json: duplicate tool name "${tool.name}"`);
    }
    seen.add(tool.name);
  }
  return problems;
};

export const checkToolOrder = ({ tools }) => {
  const names = tools.map((tool) => (typeof tool?.name === 'string' ? tool.name : ''));
  const sorted = [...names].sort();
  const index = names.findIndex((name, i) => name !== sorted[i]);
  return index === -1
    ? []
    : [`tools.json: tools must be sorted by name ("${names[index]}" at index ${index})`];
};

export const TOOLS_CHECKS = [checkToolEntries, checkToolDuplicates, checkToolOrder];

// --- Checks of the skills ----------------------------------------------------

export const checkSkillFrontmatter = ({ skills }) =>
  skills.flatMap(({ dir, file, content }) => {
    if (content === null) {
      return [`${file}: missing SKILL.md`];
    }
    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      return [`${file}: missing or unterminated YAML frontmatter`];
    }
    const problems = Object.entries(frontmatter.unsupported)
      .filter(([key]) => key === 'name' || key === 'description')
      .map(([key, reason]) => `${file}: "${key}" uses unsupported YAML (${reason})`);
    const { name, description } = frontmatter.fields;
    if (!('name' in frontmatter.unsupported)) {
      if (!name) {
        problems.push(`${file}: "name" is missing`);
      } else {
        if (name !== dir) {
          problems.push(`${file}: "name" (${name}) must equal the folder name (${dir})`);
        }
        if (name.length > SKILL_NAME_MAX_LENGTH) {
          problems.push(
            `${file}: "name" must be ${SKILL_NAME_MAX_LENGTH} characters at most (${name.length})`,
          );
        }
        if (!KEBAB_CASE.test(name)) {
          problems.push(`${file}: "name" must be kebab-case`);
        }
        if (!name.startsWith(SKILL_NAME_PREFIX)) {
          problems.push(`${file}: "name" must start with "${SKILL_NAME_PREFIX}"`);
        }
      }
    }
    if (!('description' in frontmatter.unsupported)) {
      if (!description) {
        problems.push(`${file}: "description" is missing`);
      } else if (description.length > SKILL_DESCRIPTION_MAX_LENGTH) {
        problems.push(
          `${file}: "description" must be ${SKILL_DESCRIPTION_MAX_LENGTH} characters at most (${description.length})`,
        );
      }
    }
    return problems;
  });

export const checkToolReferences = ({ references, tools }) => {
  const known = new Set(tools.map((tool) => tool?.name));
  return references
    .filter(({ name }) => !known.has(name))
    .map(({ file, line, name }) => `${file}:${line}: unknown tool "${name}" (absent from tools.json)`);
};

// --- Checks of the domain references ------------------------------------------
//
// A reference is a Markdown file under `skills/*/references/`. It documents one
// domain, and its first line says whether that domain is delivered. The state
// of a domain is deduced from the tools its reference cites. The SKILL.md of a
// skill that has references indexes them in a table whose rows are
// `| \`references/<file>.md\` | delivered |` or `| ... | upcoming |`.

export const DELIVERED_STATUS_LINE = 'Status: delivered';
export const UPCOMING_STATUS_LINE =
  'Status: upcoming — these tools may not be available on your server yet; check the tools available to you in this session.';

const REFERENCE_FILE = /^skills\/([^/]+)\/(references\/.+\.md)$/;
// A row of the references index: the path in a code span, then the status
const INDEX_ROW = /^\|\s*`(references\/[^`]+\.md)`\s*\|\s*([a-z]+)\s*\|/;

const toPosix = (file) => file.split(sep).join('/');

/**
 * Lists the references with their skill, their path inside the skill and
 * their status: 'delivered', 'upcoming' or null.
 */
const referencesOf = (skills) =>
  skills.flatMap(({ dir, markdownFiles }) =>
    markdownFiles.flatMap(({ file, content }) => {
      const match = toPosix(file).match(REFERENCE_FILE);
      if (!match || match[1] !== dir) {
        return [];
      }
      const firstLine = content.replace(/^\uFEFF/, '').split(/\r?\n/)[0].trim();
      const status =
        firstLine === DELIVERED_STATUS_LINE
          ? 'delivered'
          : firstLine === UPCOMING_STATUS_LINE
            ? 'upcoming'
            : null;
      return [{ dir, file, path: match[2], status }];
    }),
  );

const statusesByName = (tools) =>
  new Map(
    tools.filter((tool) => typeof tool?.name === 'string').map((tool) => [tool.name, tool.status]),
  );

// A delivered tool counts as documented when a file other than an upcoming or
// invalid reference cites it: an upcoming reference does not document a tool
// that is already available
export const checkDeliveredToolsCited = ({ skills, tools, references }) => {
  const notDocumenting = new Set(
    referencesOf(skills)
      .filter(({ status }) => status !== 'delivered')
      .map(({ file }) => file),
  );
  const cited = new Set(
    references.filter(({ file }) => !notDocumenting.has(file)).map(({ name }) => name),
  );
  const missing = tools
    .filter((tool) => tool?.status === 'delivered' && typeof tool.name === 'string')
    .map((tool) => tool.name)
    .filter((name) => !cited.has(name));
  return missing.length === 0
    ? []
    : [
        `skills: delivered tools cited by no skill file other than an upcoming reference: ${missing.join(', ')}`,
      ];
};

export const checkReferenceStatusLine = ({ skills }) =>
  referencesOf(skills)
    .filter(({ status }) => status === null)
    .map(
      ({ file }) =>
        `${file}:1: the first line must be exactly "${DELIVERED_STATUS_LINE}" or "${UPCOMING_STATUS_LINE}" (check the dash and the trailing sentence)`,
    );

export const checkDeliveredReferences = ({ skills, tools, references }) => {
  const statuses = statusesByName(tools);
  const delivered = new Set(
    referencesOf(skills)
      .filter(({ status }) => status === 'delivered')
      .map(({ file }) => file),
  );
  return references
    .filter(({ file, name }) => delivered.has(file) && statuses.get(name) === 'upcoming')
    .map(
      ({ file, line, name }) =>
        `${file}:${line}: a delivered reference cites the upcoming tool "${name}"`,
    );
};

export const checkUpcomingReferences = ({ skills, tools, references }) => {
  const statuses = statusesByName(tools);
  return referencesOf(skills)
    .filter(({ status }) => status === 'upcoming')
    .flatMap(({ file }) => {
      const cited = references.filter((reference) => reference.file === file);
      if (cited.length === 0) {
        return [`${file}:1: an upcoming reference must cite at least one tool`];
      }
      // Unknown tools are reported by checkToolReferences, not counted here
      const known = cited
        .map(({ name }) => statuses.get(name))
        .filter((status) => status !== undefined);
      return known.length > 0 && known.every((status) => status === 'delivered')
        ? [
            `${file}:1: every tool it cites is delivered; set its first line to "${DELIVERED_STATUS_LINE}"`,
          ]
        : [];
    });
};

export const checkReferencesIndex = ({ skills }) => {
  const references = referencesOf(skills);
  return skills.flatMap(({ dir, file, content }) => {
    const own = references.filter((reference) => reference.dir === dir);
    if (own.length === 0 || content === null) {
      return [];
    }
    const rows = content
      .split(/\r?\n/)
      .map((text, index) => ({ match: text.trim().match(INDEX_ROW), line: index + 1 }))
      .filter(({ match }) => match !== null)
      .map(({ match, line }) => ({ path: match[1], status: match[2], line }));
    const problems = [];
    for (const { path, status, line } of rows) {
      const reference = own.find((entry) => entry.path === path);
      if (!reference) {
        problems.push(`${file}:${line}: the index lists "${path}", which does not exist`);
      } else if (reference.status !== null && reference.status !== status) {
        problems.push(
          `${file}:${line}: the index says "${status}" for "${path}", whose status line says "${reference.status}"`,
        );
      }
    }
    for (const { path } of own) {
      if (!rows.some((row) => row.path === path)) {
        problems.push(`${file}: the references index does not list "${path}"`);
      }
    }
    return problems;
  });
};

export const SKILL_CHECKS = [
  checkSkillFrontmatter,
  checkToolReferences,
  checkDeliveredToolsCited,
  checkReferenceStatusLine,
  checkDeliveredReferences,
  checkUpcomingReferences,
  checkReferencesIndex,
];

// --- Checks of the manifests -------------------------------------------------

// Top entry of CHANGELOG.md: `## 0.1.0 - 2026-10-28` or `## [0.1.0]`
const changelogVersion = (content) =>
  content.match(/^## \[?(\d+\.\d+\.\d+[^\]\s]*)/m)?.[1] ?? null;

export const checkManifestVersions = ({ root }) => {
  const problems = [];
  const versions = [];
  for (const file of ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const { value, problem } = tryReadJson(root, file);
    if (problem) {
      problems.push(problem);
    } else if (typeof value?.version !== 'string') {
      problems.push(`${file}: "version" must be a string`);
    } else {
      versions.push([file, value.version]);
    }
  }
  const changelog = tryRead(join(root, 'CHANGELOG.md'));
  if (changelog.error) {
    problems.push(`CHANGELOG.md: cannot be read (${changelog.error})`);
  } else {
    const version = changelogVersion(changelog.value);
    if (version === null) {
      problems.push('CHANGELOG.md: no "## <version>" entry found');
    } else {
      versions.push(['CHANGELOG.md', version]);
    }
  }
  if (new Set(versions.map(([, version]) => version)).size > 1) {
    problems.push(
      `version mismatch: ${versions.map(([file, version]) => `${file} ${version}`).join(', ')}`,
    );
  }
  return problems;
};

export const checkMcpUrls = ({ root }) => {
  const problems = [];
  const urls = [];
  for (const file of ['.mcp.json', 'mcp.json']) {
    const { value, problem } = tryReadJson(root, file);
    if (problem) {
      problems.push(problem);
      continue;
    }
    const url = value?.mcpServers?.[MCP_SERVER_NAME]?.url;
    if (typeof url !== 'string') {
      problems.push(`${file}: no "url" for the server "${MCP_SERVER_NAME}"`);
    } else {
      urls.push([file, url]);
    }
  }
  if (new Set(urls.map(([, url]) => url)).size > 1) {
    problems.push(`MCP URL mismatch: ${urls.map(([file, url]) => `${file} ${url}`).join(', ')}`);
  }
  return problems;
};

// A path of a manifest: relative to the root, inside it, and existing
const checkPath = (root, file, field, path) => {
  if (typeof path !== 'string' || path === '') {
    return [`${file}: "${field}" must be a path`];
  }
  const target = resolve(root, path);
  const fromRoot = relative(root, target);
  if (isAbsolute(path) || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    return [`${file}: "${field}" (${path}) must stay inside the plugin`];
  }
  return existsSync(target) ? [] : [`${file}: "${field}" (${path}) does not exist`];
};

// Asset paths of a Codex `interface` object
const checkInterfacePaths = (root, file, prefix, ui) => {
  const problems = [];
  for (const field of ['composerIcon', 'logo']) {
    if (ui[field] !== undefined) {
      problems.push(...checkPath(root, file, `${prefix}.${field}`, ui[field]));
    }
  }
  for (const [index, path] of (Array.isArray(ui.screenshots) ? ui.screenshots : []).entries()) {
    problems.push(...checkPath(root, file, `${prefix}.screenshots[${index}]`, path));
  }
  return problems;
};

export const checkManifestPaths = ({ root }) => {
  const problems = [];

  // Root Agent Plugins manifest: the Codex fields live under extensions["com.openai"]
  const portableFile = 'plugin.json';
  const portable = tryReadJson(root, portableFile);
  if (portable.problem) {
    problems.push(portable.problem);
  } else {
    const ui = portable.value?.extensions?.['com.openai']?.interface ?? {};
    problems.push(
      ...checkInterfacePaths(root, portableFile, 'extensions["com.openai"].interface', ui),
    );
  }

  // Legacy Codex manifest, kept as a fallback
  const codexFile = '.codex-plugin/plugin.json';
  const codex = tryReadJson(root, codexFile);
  if (codex.problem) {
    problems.push(codex.problem);
  } else {
    for (const field of ['skills', 'mcpServers']) {
      if (codex.value?.[field] !== undefined) {
        problems.push(...checkPath(root, codexFile, field, codex.value[field]));
      }
    }
    problems.push(...checkInterfacePaths(root, codexFile, 'interface', codex.value?.interface ?? {}));
  }

  for (const file of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
    const { value, problem } = tryReadJson(root, file);
    if (problem) {
      problems.push(problem);
      continue;
    }
    const plugins = Array.isArray(value?.plugins) ? value.plugins : [];
    if (plugins.length === 0) {
      problems.push(`${file}: "plugins" must list at least one plugin`);
    }
    for (const [index, plugin] of plugins.entries()) {
      const source = plugin?.source;
      const path = typeof source === 'string' ? source : source?.path;
      problems.push(...checkPath(root, file, `plugins[${index}].source`, path));
    }
  }

  return problems;
};

export const MANIFEST_CHECKS = [checkManifestVersions, checkMcpUrls, checkManifestPaths];

// --- Run ---------------------------------------------------------------------

/** Runs every check. Returns { problems, summary }; never throws on bad input. */
export const run = (root) => {
  const loadedTools = loadTools(root);
  const loadedSkills = loadSkills(root);
  const tools = loadedTools.tools;
  const domains = new Set(
    tools.map((tool) => tool?.domain).filter((domain) => typeof domain === 'string' && domain !== ''),
  );
  // Computed once: used by the unknown-tool check and by the summary
  const references = loadedSkills.skills.flatMap(({ markdownFiles }) =>
    markdownFiles.flatMap(({ file, content }) =>
      findToolReferences(content, domains).map((reference) => ({ file, ...reference })),
    ),
  );
  const context = { root, tools, skills: loadedSkills.skills, references };

  const problems = [
    ...loadedTools.problems,
    ...loadedSkills.problems,
    ...TOOLS_CHECKS.flatMap((check) => check(context)),
    ...SKILL_CHECKS.flatMap((check) => check(context)),
    ...MANIFEST_CHECKS.flatMap((check) => check(context)),
  ];

  // Upcoming tools cited by the skills: allowed, listed in the summary
  const upcoming = new Set(
    tools.filter((tool) => tool?.status === 'upcoming').map((tool) => tool.name),
  );
  const citedUpcoming = new Map();
  for (const { name, file, line } of references) {
    if (upcoming.has(name)) {
      citedUpcoming.set(name, [...(citedUpcoming.get(name) ?? []), `${file}:${line}`]);
    }
  }

  return {
    problems,
    summary: {
      delivered: tools.filter((tool) => tool?.status === 'delivered').length,
      upcoming: upcoming.size,
      skills: loadedSkills.skills.length,
      citedUpcoming: [...citedUpcoming.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
    },
  };
};

/** Reads the arguments. Returns { root } or { error }. */
export const parseArgs = (args, defaultRoot) => {
  let root = defaultRoot;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root') {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        return { error: '--root requires a directory' };
      }
      root = value;
      index += 1;
    } else if (arg.startsWith('--root=')) {
      const value = arg.slice('--root='.length);
      if (value === '') {
        return { error: '--root requires a directory' };
      }
      root = value;
    } else {
      return { error: `unknown argument "${arg}"` };
    }
  }
  return { root: resolve(root) };
};

const main = () => {
  const { root, error } = parseArgs(
    process.argv.slice(2),
    join(fileURLToPath(import.meta.url), '..', '..'),
  );
  if (error) {
    console.error(`✘ ${error}`);
    console.error('Usage: node scripts/check-skills.mjs [--root <dir>]');
    process.exitCode = 2;
    return;
  }

  const { problems, summary } = run(root);
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`✘ ${problem}`);
    }
    console.error(`\n${problems.length} problem(s) found.`);
    process.exitCode = 1;
    return;
  }

  console.info(`✔ ${summary.skills} skill(s) checked.`);
  console.info(`Tools: ${summary.delivered} delivered, ${summary.upcoming} upcoming.`);
  if (summary.citedUpcoming.length === 0) {
    console.info('Upcoming tools cited by the skills: none.');
  } else {
    console.info('Upcoming tools cited by the skills:');
    for (const [name, places] of summary.citedUpcoming) {
      console.info(`  - ${name} (${places.join(', ')})`);
    }
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
