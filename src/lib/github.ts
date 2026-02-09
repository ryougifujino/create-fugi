import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { x as extractArchive } from 'tar'

const GITHUB_OWNER = 'ryougifujino'
const GITHUB_REPO = 'create-fugi'
const GITHUB_REPOSITORY_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`
const GITHUB_USER_AGENT = 'create-fugi-cli'

interface GithubRepositoryResponse {
  default_branch?: string
}

export interface DownloadTemplatesResult {
  branch: string
  templatesRootDir: string
}

function assertOkResponse(response: Response, requestUrl: string): void {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status} ${response.statusText}) for ${requestUrl}`)
  }
}

export async function fetchDefaultBranch(fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(GITHUB_REPOSITORY_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT,
    },
  })

  assertOkResponse(response, GITHUB_REPOSITORY_API)

  const responseJson = (await response.json()) as GithubRepositoryResponse | undefined
  const branch = responseJson?.default_branch

  if (typeof branch !== 'string' || branch.length === 0) {
    throw new Error('Failed to resolve default branch from GitHub response.')
  }

  return branch
}

export async function downloadTemplatesDirectory(
  tempRootDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DownloadTemplatesResult> {
  const branch = await fetchDefaultBranch(fetchImpl)
  const tarballUrl = `https://codeload.github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tar.gz/refs/heads/${encodeURIComponent(
    branch,
  )}`
  const tarballPath = path.join(tempRootDir, 'repository.tar.gz')
  const extractDir = path.join(tempRootDir, 'extracted')

  const tarballResponse = await fetchImpl(tarballUrl, {
    headers: {
      'User-Agent': GITHUB_USER_AGENT,
    },
  })

  assertOkResponse(tarballResponse, tarballUrl)

  const tarballBytes = Buffer.from(await tarballResponse.arrayBuffer())
  await writeFile(tarballPath, tarballBytes)
  await mkdir(extractDir, { recursive: true })

  await extractArchive({
    cwd: extractDir,
    file: tarballPath,
  })

  const extractedRepositoryRootDir = await resolveExtractedRepositoryRootDir(extractDir)
  const templatesRootDir = path.join(extractedRepositoryRootDir, 'templates')

  await assertDirectoryExists(templatesRootDir, 'Remote repository does not contain a templates directory.')

  return {
    branch,
    templatesRootDir,
  }
}

async function resolveExtractedRepositoryRootDir(extractDir: string): Promise<string> {
  const entries = await readdir(extractDir, { withFileTypes: true })
  const directories = entries.filter((entry) => entry.isDirectory())

  if (directories.length !== 1) {
    throw new Error(`Expected one root directory in repository archive, but found ${directories.length}.`)
  }

  return path.join(extractDir, directories[0]!.name)
}

async function assertDirectoryExists(directoryPath: string, errorMessage: string): Promise<void> {
  try {
    const directoryStat = await stat(directoryPath)

    if (!directoryStat.isDirectory()) {
      throw new Error(errorMessage)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(errorMessage, { cause: error })
    }

    throw error
  }
}
