import { useState } from 'react'
import { Bell, Megaphone, Plus, Send } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import { ANNOUNCEMENT_CATEGORIES } from '../../lib/config'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import { Input, Select, TextArea } from '../../components/ui/Input'
import { InlineError, PageHeader, PageSkeleton } from '../../components/ui/Misc'
import EmptyState from '../../components/ui/EmptyState'
import AnnouncementCard from '../../components/AnnouncementCard'

const EMPTY_FORM = { title: '', category: 'general', message: '' }

export default function Notices() {
  const { isTreasurer } = useAuth()
  const toast = useToast()
  const [composerOpen, setComposerOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState('')

  const { data, loading, error, reload } = useAsyncData(() => repo.announcements.list(), [])

  const announcements = data || []

  const openComposer = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setComposerOpen(true)
  }

  const publish = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.title.trim()) next.title = 'Enter a short title.'
    if (!form.message.trim()) next.message = 'Write the announcement message.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      await repo.announcements.create(form)
      toast.success('Announcement published to all residents.')
      setComposerOpen(false)
      setForm(EMPTY_FORM)
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not publish the announcement.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (announcement) => {
    setTogglingId(announcement.id)
    try {
      await repo.announcements.update(announcement.id, { is_active: !announcement.is_active })
      toast.success(announcement.is_active ? 'Announcement hidden from residents.' : 'Announcement published.')
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not update the announcement.')
    } finally {
      setTogglingId('')
    }
  }

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Notices"
        description={
          isTreasurer
            ? 'Share water, electrical and general updates with every resident.'
            : 'Updates from the PAFOWA committee.'
        }
        action={
          isTreasurer ? (
            <Button icon={Plus} onClick={openComposer}>
              Publish notice
            </Button>
          ) : null
        }
      />

      {announcements.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bell}
            title="No notices right now"
            description={
              isTreasurer
                ? 'Publish a notice to let residents know about water supply, maintenance work or meetings.'
                : 'Announcements from the committee will appear here.'
            }
            action={
              isTreasurer ? (
                <Button size="md" icon={Plus} onClick={openComposer}>
                  Publish notice
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              actions={
                isTreasurer ? (
                  <button
                    type="button"
                    onClick={() => toggle(announcement)}
                    disabled={togglingId === announcement.id}
                    className="min-h-9 rounded-full bg-slate-100 px-3.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    {togglingId === announcement.id
                      ? 'Updating…'
                      : announcement.is_active
                        ? 'Hide from residents'
                        : 'Publish again'}
                  </button>
                ) : null
              }
            />
          ))}
        </div>
      )}

      {isTreasurer ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-brand-50 p-4 text-[0.88rem] leading-relaxed text-brand-800">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0" />
          Hidden notices stay in your list so the committee keeps a record, but residents cannot see them.
        </div>
      ) : null}

      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Publish announcement"
        description="Every resident will see this notice on their home screen."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setComposerOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button icon={Send} onClick={publish} loading={saving}>
              Publish
            </Button>
          </div>
        }
      >
        <form onSubmit={publish} className="space-y-4" noValidate>
          <Input
            label="Title"
            name="title"
            placeholder="e.g. Water supply interruption on 12 November"
            value={form.title}
            onChange={(event) => {
              setForm((current) => ({ ...current, title: event.target.value }))
              setErrors((current) => ({ ...current, title: undefined }))
            }}
            error={errors.title}
            autoFocus
          />
          <Select
            label="Category"
            name="category"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            options={ANNOUNCEMENT_CATEGORIES}
          />
          <TextArea
            label="Message"
            name="message"
            rows={5}
            placeholder="Share the timing, reason and what residents should do."
            value={form.message}
            onChange={(event) => {
              setForm((current) => ({ ...current, message: event.target.value }))
              setErrors((current) => ({ ...current, message: undefined }))
            }}
            error={errors.message}
          />
        </form>
      </Modal>
    </div>
  )
}
