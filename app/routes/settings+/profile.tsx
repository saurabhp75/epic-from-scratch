import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, Outlet, useMatches } from '@remix-run/react'
import { z } from 'zod'
import { Spacer } from '~/components/spacer'
import { Icon } from '~/components/ui/icon'
import { prisma } from '~/utils/db.server'
import { cn, invariantResponse } from '~/utils/misc'
import { useUser } from '~/utils/user'

export const handle = {
	breadcrumb: <Icon name="file-text">Edit Profile</Icon>,
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = 'some_user_id' // we'll take care of this next
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { username: true },
	})
	invariantResponse(user, 'User not found', { status: 404 })
	return json({})
}
const BreadcrumbHandleMatch = z.object({
	handle: z.object({ breadcrumb: z.any() }),
})

export default function EditUserProfile() {
	const user = useUser()
	const matches = useMatches()
	const breadcrumbs = matches
		.map(m => {
			const result = BreadcrumbHandleMatch.safeParse(m)
			if (!result.success || !result.data.handle.breadcrumb) return null
			return (
				<Link key={m.id} to={m.pathname} className="flex items-center">
					{result.data.handle.breadcrumb}
				</Link>
			)
		})
		.filter(Boolean)

	return (
		<div className="m-auto mb-24 mt-16 max-w-3xl">
			<div className="container">
				<ul className="flex gap-3">
					<li>
						<Link
							className="text-muted-foreground"
							to={`/users/${user.username}`}
						>
							Profile
						</Link>
					</li>
					{breadcrumbs.map((breadcrumb, i, arr) => (
						<li
							key={i}
							className={cn('flex items-center gap-3', {
								'text-muted-foreground': i < arr.length - 1,
							})}
						>
							▶️ {breadcrumb}
						</li>
					))}
				</ul>
			</div>
			<Spacer size="xs" />
			<main className="mx-auto bg-muted px-6 py-8 md:container md:rounded-3xl">
				<Outlet />
			</main>
		</div>
	)
}
