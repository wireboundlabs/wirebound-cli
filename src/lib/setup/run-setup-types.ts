import {type ProgressReporter} from '@/lib/progress'

export interface Auth0Credentials {
  domain: string
  clientId: string
  clientSecret: string
}

export interface RunSetupOptions {
  targetDir: string
  profileName: string
  force: boolean
  check: boolean
  setDefault?: boolean
  credentials: Auth0Credentials
  confirmOverwrite?: (configPath: string) => Promise<boolean>
  confirmSetDefault?: (profileName: string, targetDir: string) => Promise<boolean>
  log: (message: string) => void
  progress?: ProgressReporter
}
