import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageCircle,
  Reply,
  Edit,
  Trash2,
  Check,
  X,
  MoreVertical,
  CheckCircle,
  Circle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface Comment {
  id: string
  entity_type: string
  entity_id: string
  parent_comment_id?: string
  thread_root_id?: string
  depth: number
  content: string
  content_html?: string
  user_id: string
  user_hash?: string
  created_at: string
  updated_at: string
  edited: boolean
  mentioned_users?: string[]
  status: 'open' | 'resolved' | 'deleted'
  resolved_at?: string
  resolved_by?: string
  reactions?: Record<string, number>
}

interface CommentThreadProps {
  entityType: string
  entityId: string
  className?: string
}

export function CommentThread({ entityType, entityId, className }: CommentThreadProps) {
  const { t } = useTranslation('comments')
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check authentication status
    const userHash = localStorage.getItem('omnicore_user_hash')
    setIsAuthenticated(!!userHash)
  }, [])

  useEffect(() => {
    fetchComments()
  }, [entityType, entityId, showResolved])

  const fetchComments = async () => {
    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
        include_resolved: showResolved.toString()
      })
      const response = await fetch(`/api/comments?${params}`)
      if (response.ok) {
        const data = await response.json()
        setComments(data)
      }
    } catch (error) {
      console.error('[Comments] Fetch failed:', error)
    }
  }

  const handleAddComment = async (parentId?: string) => {
    const content = parentId ? (document.getElementById(`reply-${parentId}`) as HTMLTextAreaElement)?.value : newComment
    if (!content.trim()) return

    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          parent_comment_id: parentId,
          content
        })
      })

      if (response.ok) {
        if (parentId) {
          setReplyingTo(null)
        } else {
          setNewComment('')
        }
        await fetchComments()
      }
    } catch (error) {
      console.error('[Comments] Add failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (commentId: string) => {
    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')

      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({ content: editContent })
      })

      if (response.ok) {
        setEditingId(null)
        setEditContent('')
        await fetchComments()
      }
    } catch (error) {
      console.error('[Comments] Edit failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm(t('confirmDelete'))) return

    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')

      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        }
      })

      if (response.ok) {
        await fetchComments()
      }
    } catch (error) {
      console.error('[Comments] Delete failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (commentId: string, resolved: boolean) => {
    setLoading(true)
    try {
      const userHash = localStorage.getItem('omnicore_user_hash')

      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(userHash && { 'Authorization': `Bearer ${userHash}` })
        },
        body: JSON.stringify({ action: resolved ? 'unresolve' : 'resolve' })
      })

      if (response.ok) {
        await fetchComments()
      }
    } catch (error) {
      console.error('[Comments] Resolve failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const buildCommentTree = (comments: Comment[]): Comment[] => {
    const rootComments = comments.filter(c => !c.parent_comment_id)
    return rootComments
  }

  const getReplies = (parentId: string): Comment[] => {
    return comments.filter(c => c.parent_comment_id === parentId)
  }

  const renderComment = (comment: Comment) => {
    const isEditing = editingId === comment.id
    const replies = getReplies(comment.id)
    const isResolved = comment.status === 'resolved'

    return (
      <div key={comment.id} className={cn(
        "border-l-2 pl-4 py-2",
        isResolved ? "border-green-200 dark:border-green-800" : "border-gray-200 dark:border-gray-700",
        comment.depth > 0 && "ml-4 mt-2"
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{comment.user_id === 'guest' ? t('guest') : `User ${comment.user_id.slice(0, 8)}`}</span>
              <span>•</span>
              <span>{new Date(comment.created_at).toLocaleString()}</span>
              {comment.edited && <span className="text-xs italic">(edited)</span>}
              {isResolved && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                  <CheckCircle className="h-3 w-3" />
                  {t('resolved')}
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[80px]"
                  placeholder={t('editPlaceholder')}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEdit(comment.id)} disabled={loading}>
                    <Check className="h-4 w-4 mr-1" />
                    {t('save')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditingId(null)
                    setEditContent('')
                  }}>
                    <X className="h-4 w-4 mr-1" />
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: comment.content_html || comment.content }} />

                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    {t('reply')}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleResolve(comment.id, isResolved)}
                  >
                    {isResolved ? (
                      <>
                        <Circle className="h-3 w-3 mr-1" />
                        {t('unresolve')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('resolve')}
                      </>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingId(comment.id)
                        setEditContent(comment.content)
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        {t('edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(comment.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Reply form */}
        {replyingTo === comment.id && (
          <div className="mt-3 ml-4 space-y-2">
            <Textarea
              id={`reply-${comment.id}`}
              placeholder={t('replyPlaceholder')}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAddComment(comment.id)} disabled={loading}>
                {t('addReply')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Nested replies */}
        {replies.length > 0 && (
          <div className="mt-2">
            {replies.map(reply => renderComment(reply))}
          </div>
        )}
      </div>
    )
  }

  const rootComments = buildCommentTree(comments)

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {t('title')} ({comments.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowResolved(!showResolved)}
        >
          {showResolved ? t('hideResolved') : t('showResolved')}
        </Button>
      </div>

      {/* New comment form */}
      {isAuthenticated ? (
        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('placeholder')}
            className="min-h-[100px]"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">{t('markdownSupport')}</span>
            <Button onClick={() => handleAddComment()} disabled={loading || !newComment.trim()}>
              {t('add')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
          <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
            {t('loginRequired', 'Sign in to comment')}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('loginMessage', 'Create a bookmark or sign in to join the discussion')}
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              onClick={() => window.location.href = '/login'}
              variant="default"
            >
              {t('signIn', 'Sign In')}
            </Button>
            <Button
              onClick={() => window.location.href = '/dashboard/settings'}
              variant="outline"
            >
              {t('createBookmark', 'Create Bookmark')}
            </Button>
          </div>
        </div>
      )}

      {/* Comments list */}
      {rootComments.length > 0 ? (
        <div className="space-y-2">
          {rootComments.map(comment => renderComment(comment))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {t('noComments')}
        </div>
      )}
    </div>
  )
}
