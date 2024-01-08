import { Link, NavLink, Outlet } from '@remix-run/react'

export default function NotesRoute() {
	return (
		<div className="flex h-full justify-between border-8 border-blue-500 pb-12">
			<h1 className="text-h1">Notes</h1>
			<ul>
				<li>
					<Link to=".." relative="path">
						Back to Kody
					</Link>
				</li>
				<li>
					<NavLink
						to="some-note-id"
						className={({ isActive }) => {
							return `underline ${isActive ? `bg-accent` : ''}`
						}}
					>
						Some note
					</NavLink>
				</li>
			</ul>
			<Outlet />
		</div>
	)
}
