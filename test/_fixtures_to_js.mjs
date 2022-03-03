#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

async function main () {
  const thisdir = dirname(new URL(import.meta.url).pathname)
  const outfile = join(thisdir, 'fixtures.js')
  const fixturesdir = join(thisdir, 'fixtures')
  const files = await readdir(fixturesdir)
  let content = '/** @type {Record<string, string>} */\nexport const data = {\n'
  for (const f of files) {
    content += `  '${f}': '`
    content += (await readFile(join(fixturesdir, f))).toString('base64')
    content += '\',\n'
  }
  content += '  _: \'\'\n}\n'
  await writeFile(join(outfile), content, 'utf8')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
