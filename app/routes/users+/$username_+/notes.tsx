import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { Link, NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { db } from '~/utils/db.server'
import { cn, invariantResponse } from '~/utils/misc'

export async function loader({ params }: LoaderFunctionArgs) {
	const { username } = params
	const owner = db.user.findFirst({
		where: {
			username: { equals: username },
		},
	})
	invariantResponse(owner, 'owner not found', { status: 404 })
	const notes = db.note.findMany({
		where: {
			owner: {
				username: { equals: username },
			},
		},
	})

	return json({ owner, notes })
}
export default function NotesRoute() {
	const data = useLoaderData<typeof loader>()
	const ownerDisplayName = data.owner?.name ?? data.owner?.username

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
							{data.notes.map(note => (
								<li key={note.id} className="p-1 pr-0">
									<NavLink
										to={note.id}
										className={({ isActive }) =>
											cn(navLinkDefaultClassName, isActive && 'bg-accent')
										}
									>
										{note.title}
									</NavLink>
								</li>
							))}
							{/*
							🐨 instead of hard coding the note, create one <li> for each note
							in the database with data.notes.map
						*/}
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
