import type { RepoRecord } from '../../types/repo'
import { scoreRepository } from './scoring'

type SeedRepo = Omit<RepoRecord, 'issues' | 'score' | 'scoreBreakdown'>

const seedRepos: SeedRepo[] = [
  {
    id: 1,
    name: 'gittidy',
    fullName: 'carlosfranzetti/gittidy',
    description:
      'AI-assisted GitHub cleanup dashboard for students and indie developers.',
    private: false,
    language: 'TypeScript',
    updatedAt: '2026-05-08T13:40:00Z',
    homepage: '',
    topics: ['vite', 'react', 'developer-tools'],
    defaultBranch: 'main',
    readmeWordCount: 78,
    readmeExcerpt:
      'GitTidy is an AI-assisted GitHub cleanup dashboard for students and indie developers. It scans repositories for README, description, homepage, and topic gaps.',
    insights: [
      { label: 'README', value: 'Short overview only' },
      { label: 'Deploy', value: 'No public app link yet' },
      { label: 'Topics', value: '3 tags, missing AI-specific context' },
    ],
  },
  {
    id: 2,
    name: 'portfolio-lab',
    fullName: 'carlosfranzetti/portfolio-lab',
    description: '',
    private: false,
    language: 'JavaScript',
    updatedAt: '2026-05-07T18:12:00Z',
    homepage: 'https://portfolio-lab.vercel.app',
    topics: [],
    defaultBranch: 'main',
    readmeWordCount: 12,
    readmeExcerpt: 'Portfolio Lab\n\nnpm install\nnpm run dev',
    insights: [
      { label: 'README', value: 'Install command only' },
      { label: 'Deploy', value: 'Live site present' },
      { label: 'Topics', value: 'No discoverability tags' },
    ],
  },
  {
    id: 3,
    name: 'campus-api',
    fullName: 'carlosfranzetti/campus-api',
    description: 'REST API for student event and club discovery.',
    private: true,
    language: 'Go',
    updatedAt: '2026-05-06T09:25:00Z',
    homepage: '',
    topics: ['go', 'rest-api'],
    defaultBranch: 'master',
    readmeWordCount: 214,
    readmeExcerpt:
      'Campus API provides REST endpoints for student events and club discovery. It includes setup instructions, endpoint examples, and local development notes.',
    insights: [
      { label: 'README', value: 'Strong setup and endpoint coverage' },
      { label: 'Deploy', value: 'Missing docs or staging link' },
      { label: 'Topics', value: 'Solid base tags, can be more specific' },
    ],
  },
  {
    id: 4,
    name: 'pixel-dungeon-tools',
    fullName: 'carlosfranzetti/pixel-dungeon-tools',
    description: 'Utilities for balancing levels and loot tables in a 2D roguelike.',
    private: false,
    language: 'Python',
    updatedAt: '2026-05-04T22:03:00Z',
    homepage: 'https://github.com/carlosfranzetti/pixel-dungeon-tools',
    topics: ['python', 'game-dev', 'tooling', 'balancing'],
    defaultBranch: 'main',
    readmeWordCount: 166,
    readmeExcerpt:
      'Pixel Dungeon Tools contains Python utilities for balancing roguelike levels, loot tables, and design data for a 2D game project.',
    insights: [
      { label: 'README', value: 'Good examples, missing visuals' },
      { label: 'Deploy', value: 'Homepage points to repo only' },
      { label: 'Topics', value: 'Healthy topic coverage' },
    ],
  },
]

export const mockRepos: RepoRecord[] = seedRepos.map((repo) => {
  const result = scoreRepository({
    description: repo.description,
    homepage: repo.homepage,
    topics: repo.topics,
    readmeWordCount: repo.readmeWordCount,
  })

  return {
    ...repo,
    ...result,
    readmeLoaded: true,
  }
})
