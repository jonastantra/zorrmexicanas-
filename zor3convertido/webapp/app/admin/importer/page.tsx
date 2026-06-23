import VideoImporter from '@zorritas/video-importer/admin/VideoImporter'
import '@zorritas/video-importer/admin/video-importer.css'

export const dynamic = 'force-dynamic'

export default function ImporterPage() {
  return <VideoImporter apiBase="/api/admin/importer" />
}
