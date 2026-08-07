function encodeField(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = value instanceof Date ? value.toISOString() : String(value)
  if (/[",\n\r]/.test(text)) {
    text = '"' + text.replace(/"/g, '""') + '"'
  }
  return text
}

export function toCsv(columns: string[], rows: unknown[][]): string {
  let lines = [columns.map(encodeField).join(',')]
  for (let row of rows) {
    lines.push(row.map(encodeField).join(','))
  }
  return lines.join('\n') + '\n'
}
