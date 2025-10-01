import { Users, UserPlus, Mail, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const team = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', initials: 'JD' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Analyst', initials: 'JS' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'Researcher', initials: 'BJ' }
]

export function CollaborationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Collaboration</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage team members and shared analyses</p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>People you're collaborating with</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {team.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{member.role}</span>
                  <Button variant="ghost" size="sm">
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shared Analyses</CardTitle>
          <CardDescription>Analyses shared with your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Share2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No shared analyses yet</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
