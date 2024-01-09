import { Link, NavLink, Outlet, useParams } from '@remix-run/react'
import { cn } from '~/utils/misc'

export default function NotesRoute() {
	const params = useParams()
	const ownerDisplayName = params.username
	const navLinkDefaultClassName =
		'line-clamp-2 block rounded-l-full py-2 pl-8 pr-6 text-base lg:text-xl'
	return (
		<main className="container flex h-full min-h-[400px] px-0 pb-12 md:px-8">
			<div className="grid w-full grid-cols-4 bg-muted pl-2 md:container md:mx-2 md:rounded-3xl md:pr-0">
				<div className="relative col-span-1">
					<div className="absolute inset-0 flex flex-col">
						<Link to=".." relative="path" className="pb-4 pl-8 pr-4 pt-12">
							<h1 className="text-base font-bold md:text-lg lg:text-left lg:text-2xl">
								{`${ownerDisplayName}'s Notes`}
							</h1>
						</Link>
						<ul className="overflow-y-auto overflow-x-hidden pb-12">
							{/*
							🐨 instead of hard coding the note, create one <li> for each note
							in the database with data.notes.map
						*/}
							<li className="p-1 pr-0">
								<NavLink
									to="some-note-id"
									className={({ isActive }) =>
										cn(navLinkDefaultClassName, isActive && 'bg-accent')
									}
								>
									Some Note
								</NavLink>
							</li>
						</ul>
					</div>
				</div>
				<div className="relative col-span-3 bg-accent md:rounded-r-3xl">
					<Outlet />
				</div>
			</div>
		</main>
	)
}
