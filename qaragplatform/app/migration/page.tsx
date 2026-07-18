'use client'

import { useState, useRef } from 'react'
import {
  Github, GitlabIcon, Cloud, HardDrive, Upload, Bell,
  ArrowRight, Check, Globe, Database, Archive, FolderOpen,
  Zap, Code, FileText, ChevronRight
} from 'lucide-react'

interface SourceConnector {
  id: string
  name: string
  icon: typeof Github
  category: string
}

const SOURCES: SourceConnector[] = [
  // Git Repositories
  { id: 'github', name: 'GitHub', icon: Github, category: 'Git Repositories' },
  { id: 'gitlab', name: 'GitLab', icon: GitlabIcon, category: 'Git Repositories' },
  { id: 'bitbucket-cloud', name: 'Bitbucket Cloud', icon: GitlabIcon, category: 'Git Repositories' },
  { id: 'bitbucket-server', name: 'Bitbucket Server', icon: GitlabIcon, category: 'Git Repositories' },
  { id: 'azure-devops', name: 'Azure DevOps', icon: GitlabIcon, category: 'Git Repositories' },
  { id: 'aws-codecommit', name: 'AWS CodeCommit', icon: Cloud, category: 'Git Repositories' },
  { id: 'gitea', name: 'Gitea / Forgejo', icon: GitlabIcon, category: 'Git Repositories' },
  // Local & Archive
  { id: 'zip', name: 'ZIP Upload', icon: Archive, category: 'Local & Archive' },
  { id: 'local-folder', name: 'Local Folder', icon: FolderOpen, category: 'Local & Archive' },
  // Cloud Storage
  { id: 'aws-s3', name: 'AWS S3', icon: Cloud, category: 'Cloud Storage' },
  { id: 'azure-blob', name: 'Azure Blob', icon: Database, category: 'Cloud Storage' },
  { id: 'gcs', name: 'Google Cloud Storage', icon: Globe, category: 'Cloud Storage' },
  // File Sharing
  { id: 'google-drive', name: 'Google Drive', icon: Globe, category: 'File Sharing' },
  { id: 'onedrive', name: 'OneDrive', icon: Cloud, category: 'File Sharing' },
  { id: 'sharepoint', name: 'SharePoint', icon: Database, category: 'File Sharing' },
  // CI/CD
  { id: 'jenkins', name: 'Jenkins', icon: Zap, category: 'CI/CD Artifacts' },
  { id: 'github-actions', name: 'GitHub Actions', icon: Github, category: 'CI/CD Artifacts' },
  { id: 'gitlab-ci', name: 'GitLab CI', icon: GitlabIcon, category: 'CI/CD Artifacts' },
  { id: 'teamcity', name: 'TeamCity', icon: Code, category: 'CI/CD Artifacts' },
  { id: 'bamboo', name: 'Bamboo', icon: HardDrive, category: 'CI/CD Artifacts' },
]

const CATEGORIES = ['Git Repositories', 'Local & Archive', 'Cloud Storage', 'File Sharing', 'CI/CD Artifacts']

const LANGUAGES = ['Java', 'Python', 'C#', 'TypeScript', 'Robot', 'Gherkin']

export default function MigrationPage() {
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [expandedCategory, setExpandedCategory] = useState('Git Repositories')
  const [zipFiles, setZipFiles] = useState<File[]>([])
  const [notifyOnDone, setNotifyOnDone] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notification, setNotification] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const toggleSource = (id: string) => {
    setSelectedSources(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const handleZipDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      f.name.endsWith('.zip')
    )
    if (dropped.length > 0) setZipFiles(prev => [...prev, ...dropped])
  }

  const handleZipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setZipFiles(prev => [...prev, ...Array.from(e.target.files!)])
  }

  const handleStartMigration = async () => {
    if (selectedSources.length === 0 && zipFiles.length === 0) {
      setNotification('Select at least one source or upload a ZIP file to start.')
      return
    }
    setUploading(true)
    setNotification('')

    try {
      const formData = new FormData()
      formData.append('sources', JSON.stringify(selectedSources))
      if (notifyOnDone) formData.append('notify', 'true')
      zipFiles.forEach(f => formData.append('files', f))

      const res = await fetch('/api/migration', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.success) {
        setNotification(data.summary)
        setSelectedSources([])
        setZipFiles([])
      } else {
        setNotification('Migration failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      setNotification('Migration failed: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const getConnectorsForCategory = (cat: string) => SOURCES.filter(s => s.category === cat)

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '3px 8px', borderRadius: 4, background: 'rgba(217,119,6,0.1)',
            color: '#D97706'
          }}>
            V3
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            20 enterprise sources · AST parsing · TypeScript validation · PR auto-generation
          </span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
          Migration Studio
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
          Migrate documents and test suites from external sources into your knowledge base.
        </p>
      </div>

      {/* New Badges Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.15)'
        }}>
          <FileText size={12} color="#D97706" />
          <span style={{ fontSize: 11, fontWeight: 500, color: '#92400E' }}>New: Migration History</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)'
        }}>
          <Code size={12} color="#3B82F6" />
          <span style={{ fontSize: 11, fontWeight: 500, color: '#1E40AF' }}>Company Coding Standards — injected into Stage 4+5</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)'
        }}>
          <Zap size={12} color="#10B981" />
          <span style={{ fontSize: 11, fontWeight: 500, color: '#065F46' }}>New: Project Scanner</span>
        </div>
      </div>

      {/* Scan First Button */}
      <a
        href="/scanner"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 20px', borderRadius: 8,
          background: 'linear-gradient(135deg, #D97706, #F59E0B)',
          color: 'white', fontSize: 13, fontWeight: 600,
          textDecoration: 'none', marginBottom: 32,
          transition: 'opacity 0.15s'
        }}
      >
        <Zap size={14} />
        Scan First
        <ArrowRight size={14} />
      </a>

      {/* Source Categories */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Sources</h2>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 16px' }}>
          Select the sources you want to migrate from. Multiple sources can be selected.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CATEGORIES.map(cat => {
            const connectors = getConnectorsForCategory(cat)
            const isExpanded = expandedCategory === cat
            const selectedInCat = connectors.filter(c => selectedSources.includes(c.id))

            return (
              <div key={cat} style={{
                background: 'var(--surface)',
                borderRadius: 10, border: '1px solid var(--border)',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => setExpandedCategory(isExpanded ? '' : cat)}
                  style={{
                    width: '100%', padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: 'var(--text)',
                    fontFamily: 'inherit'
                  }}
                >
                  <ChevronRight size={14}
                    style={{ color: 'var(--text-3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                  />
                  {cat}
                  {selectedInCat.length > 0 && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10,
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(217,119,6,0.1)', color: '#D97706',
                      fontWeight: 600
                    }}>
                      {selectedInCat.length}
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: 6, padding: '4px 16px 12px'
                  }}>
                    {connectors.map(source => {
                      const Icon = source.icon
                      const isSelected = selectedSources.includes(source.id)

                      return (
                        <button
                          key={source.id}
                          onClick={() => toggleSource(source.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 8,
                            border: `1px solid ${isSelected ? '#D97706' : 'var(--border)'}`,
                            background: isSelected ? 'rgba(217,119,6,0.06)' : 'var(--bg)',
                            cursor: 'pointer', fontSize: 11, color: 'var(--text)',
                            fontFamily: 'inherit', textAlign: 'left',
                            transition: 'border-color 0.15s, background 0.15s'
                          }}
                        >
                          <Icon size={14} color={isSelected ? '#D97706' : '#9E9485'} />
                          <span style={{ flex: 1 }}>{source.name}</span>
                          {isSelected && <Check size={12} color="#D97706" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ZIP Upload */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Test Suite Upload</h2>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 12px' }}>
          Drop your test suite ZIP here for automatic parsing and migration.
        </p>

        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleZipDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
            background: 'var(--surface)',
            transition: 'border-color 0.15s, background 0.15s'
          }}
        >
          <Upload size={28} color="#9E9485" style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>
            <span style={{ color: '#D97706', fontWeight: 600 }}>Click to browse</span> or drag a ZIP file here
          </p>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {LANGUAGES.map(lang => (
              <span key={lang} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                background: 'rgba(217,119,6,0.08)', color: '#92400E',
                fontWeight: 500
              }}>
                {lang}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '8px 0 0' }}>
            up to 50 files
          </p>
          <input ref={inputRef} type="file" accept=".zip" onChange={handleZipSelect} style={{ display: 'none' }} />
        </div>

        {zipFiles.length > 0 && (
          <div style={{
            marginTop: 8, padding: '10px 14px',
            background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Archive size={14} color="#D97706" />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>
              {zipFiles.length} ZIP file{zipFiles.length > 1 ? 's' : ''} selected
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {zipFiles.reduce((sum, f) => sum + f.size, 0) > 0
                ? (zipFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(1) + ' MB'
                : ''}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
        padding: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {selectedSources.length + (zipFiles.length > 0 ? 1 : 0)} source{selectedSources.length + (zipFiles.length > 0 ? 1 : 0) !== 1 ? 's' : ''} selected
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
              {selectedSources.length > 0 && `${selectedSources.length} connector${selectedSources.length > 1 ? 's' : ''}`}
              {selectedSources.length > 0 && zipFiles.length > 0 && ' + '}
              {zipFiles.length > 0 && `${zipFiles.length} ZIP file${zipFiles.length > 1 ? 's' : ''}`}
              {selectedSources.length === 0 && zipFiles.length === 0 && 'No sources selected'}
            </p>
          </div>

          <label style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontSize: 12, color: 'var(--text-2)'
          }}>
            <input
              type="checkbox"
              checked={notifyOnDone}
              onChange={e => setNotifyOnDone(e.target.checked)}
              style={{ accentColor: '#D97706' }}
            />
            <Bell size={12} />
            Notify when done
          </label>
        </div>

        <button
          onClick={handleStartMigration}
          disabled={uploading || (selectedSources.length === 0 && zipFiles.length === 0)}
          style={{
            width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none',
            background: uploading || (selectedSources.length === 0 && zipFiles.length === 0)
              ? '#9E9485' : 'linear-gradient(135deg, #D97706, #F59E0B)',
            color: 'white', fontSize: 13, fontWeight: 600,
            cursor: uploading || (selectedSources.length === 0 && zipFiles.length === 0) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Upload size={14} />
          {uploading ? 'Starting Migration...' : 'Start Migration'}
        </button>

        {notification && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: notification.includes('failed') || notification.includes('Select')
              ? '#FEF2F2' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${notification.includes('failed') || notification.includes('Select') ? '#FECACA' : 'rgba(16,185,129,0.2)'}`,
            fontSize: 12, color: notification.includes('failed') || notification.includes('Select') ? '#991B1B' : '#065F46'
          }}>
            {notification}
          </div>
        )}
      </div>
    </div>
  )
}
