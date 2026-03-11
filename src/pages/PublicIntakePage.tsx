import { useParams } from 'react-router-dom'
import PublicIntakeForm from '../components/cop/PublicIntakeForm'

export default function PublicIntakePage() {
  const { token } = useParams<{ token: string }>()
  if (!token) return <div className="p-4 text-center text-sm text-red-400">Invalid link</div>
  return <PublicIntakeForm token={token} />
}
