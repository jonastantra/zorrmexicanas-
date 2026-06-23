import fs from 'node:fs'
import path from 'node:path'
import type { SiteProfile } from './types.js'

export class ProfileStore {
  constructor(private filePath = path.join(process.cwd(), 'video-importer.profiles.json')) {}

  list(): SiteProfile[] {
    if (!fs.existsSync(this.filePath)) return []
    return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as SiteProfile[]
  }

  save(profile: SiteProfile): SiteProfile[] {
    const profiles = this.list()
    const index = profiles.findIndex((item) => item.id === profile.id)
    if (index >= 0) profiles[index] = profile
    else profiles.push(profile)
    fs.writeFileSync(this.filePath, JSON.stringify(profiles, null, 2))
    return profiles
  }

  remove(id: string): SiteProfile[] {
    const profiles = this.list().filter((item) => item.id !== id)
    fs.writeFileSync(this.filePath, JSON.stringify(profiles, null, 2))
    return profiles
  }

  get(id: string): SiteProfile | undefined {
    return this.list().find((item) => item.id === id)
  }
}
