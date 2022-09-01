import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CodeGetter, DefineTransformTestOptions } from './_utils'
import { defineTransformTest } from './_utils'

const CommonCodeGetter: CodeGetter = ({ entry }) => `<script lang="ts" setup>
import { Props } from '${entry}'

defineProps<Props>()
</script>
`

const DynamicCodeGetter: CodeGetter = async ({ entry }) => readFile(resolve(__dirname, entry), 'utf-8')

const structureRE = /.+\/temp\/(.+)\/(.+)\//g

const Options = {
  Common: {
    filePattern: ['./fixtures/temp/**/!(_)*.ts'],
    codeGetter: CommonCodeGetter,
  },
  Dynamic: {
    filePattern: ['./fixtures/temp/**/*.vue'],
    codeGetter: DynamicCodeGetter,
  },
}

function genOptions(type: 'common' | 'dynamic', skip = false): DefineTransformTestOptions {
  const opts = type === 'common' ? Options.Common : Options.Dynamic

  return {
    ...opts,
    category: 'Temp',
    fileName: __filename,
    structureRE,
    realPath: type === 'dynamic',
    skip,
  }
}

defineTransformTest(genOptions('common'))
