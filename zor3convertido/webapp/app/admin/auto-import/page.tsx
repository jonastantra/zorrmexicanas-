import AutoImportPanel from './AutoImportPanel'
import './auto-import.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Importador automático',
  robots: 'noindex, nofollow',
}

export default function AutoImportPage() {
  return <AutoImportPanel apiBase="/api/admin/auto-import" />
}
