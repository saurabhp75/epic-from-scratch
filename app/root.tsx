import os from 'node:os'
import { useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { cssBundleHref } from '@remix-run/css-bundle'
import {
	type LinksFunction,
	json,
	type MetaFunction,
	type LoaderFunctionArgs,
	redirect,
} from '@remix-run/node'
import {
	Link,
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useFetcher,
	useFetchers,
	useLoaderData,
	useMatches,
} from '@remix-run/react'

import { useEffect } from 'react'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import { Toaster, toast as showToast } from 'sonner'
import { z } from 'zod'
import faviconAssetUrl from './assets/favicon.svg'
import { GeneralErrorBoundary } from './components/error-boundary'
import { ErrorList } from './components/forms'
import { SearchBar } from './components/search-bar'
import { Spacer } from './components/spacer'
// import {
// 	AlertDialog,
// 	AlertDialogAction,
// 	AlertDialogCancel,
// 	AlertDialogContent,
// 	AlertDialogDescription,
// 	AlertDialogTitle,
// 	AlertDialogFooter,
// 	AlertDialogHeader,
// } from './components/ui/alert-dialog'
import { Button } from './components/ui/button'
import { Icon } from './components/ui/icon'
import fontStylesheetUrl from './styles/font.css'
import tailwindStylesheetUrl from './styles/tailwind.css'
import { getUserId } from './utils/auth.server'
import { csrf } from './utils/csrf.server'
import { prisma } from './utils/db.server'
import { getEnv } from './utils/env.server'
import { honeypot } from './utils/honeypot.server'
import { combineHeaders, getUserImgSrc, invariantResponse } from './utils/misc'
import { userHasRole } from './utils/permissions'
import { getTheme, setTheme, type Theme } from './utils/theme.server'
import { type Toast, getToast } from './utils/toast.server'
import { useOptionalUser } from './utils/user'

export const links: LinksFunction = () => {
	return [
		...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
		{
			type: 'image/svg+xml',
			href: faviconAssetUrl,
			rel: 'icon',
		},
		{
			href: fontStylesheetUrl,
			rel: 'stylesheet',
		},
		{
			href: tailwindStylesheetUrl,
			rel: 'stylesheet',
		},
	]
}

export const meta: MetaFunction = () => {
	return [
		{ title: 'Epic Notes' },
		{ name: 'description', content: `Your own captain's log` },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const honeyProps = honeypot.getInputProps()
	const [csrfToken, csrfCookieHeader] = await csrf.commitToken(request)

	const { toast, headers: toastHeaders } = await getToast(request)

	const userId = await getUserId(request)

	// if there's a userId, then get the user from the database
	// you will want to specify a select. You'll need the id, username, name,
	// and image's id
	const user = userId
		? await prisma.user.findUniqueOrThrow({
				select: {
					id: true,
					name: true,
					username: true,
					image: { select: { id: true } },
					roles: {
						select: {
							name: true,
							permissions: {
								select: { entity: true, action: true, access: true },
							},
						},
					},
				},
				where: { id: userId },
			})
		: null

	// if there's a userId but no user then something's wrong.
	// Let's delete destroy the session and redirect to the home page.
	if (userId && !user) {
		// get the cookie header from the request
		const cookieSession = await sessionStorage.getSession(
			request.headers.get('cookie'),
		)
		// something weird happened... The user is authenticated but we can't find
		// them in the database. Maybe they were deleted? Let's log them out.
		throw redirect('/', {
			headers: {
				'set-cookie': await sessionStorage.destroySession(cookieSession),
			},
		})
	}

	return json(
		{
			username: os.userInfo().username,
			user,
			theme: getTheme(request),
			toast,
			ENV: getEnv(),
			honeyProps,
			csrfToken,
		},
		{
			// "combineHeaders" combine 'set-cookie' headers for toast
			// and csrf related cookies
			headers: combineHeaders(
				csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : null,
				toastHeaders,
			),
		},
	)
}

const ThemeFormSchema = z.object({
	theme: z.enum(['light', 'dark']),
})

export async function action({ request }: LoaderFunctionArgs) {
	const formData = await request.formData()
	invariantResponse(
		formData.get('intent') === 'update-theme',
		'Invalid intent',
		{ status: 400 },
	)
	const submission = parse(formData, {
		schema: ThemeFormSchema,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'success', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const { theme } = submission.value

	const responseInit = {
		headers: {
			// add a 'set-cookie' header to this response and set it to the
			// serialized cookie:
			'set-cookie': setTheme(theme),
		},
	}

	// we'll do stuff with the submission next...
	return json({ success: true, submission }, responseInit)
}

function App() {
	const data = useLoaderData<typeof loader>()
	const theme = useTheme()
	const user = useOptionalUser()
	const matches = useMatches()
	// use the userHasRole utility to determine if the user is an admin
	const userIsAdmin = userHasRole(user, 'admin')
	const isOnSearchPage = matches.find(m => m.id === 'routes/users+/index')

	return (
		<Document theme={theme} env={data.ENV}>
			<header className="container px-6 py-4 sm:px-8 sm:py-6">
				<nav className="flex items-center justify-between gap-4 sm:gap-6">
					<Link to="/">
						<div className="font-light">epic</div>
						<div className="font-bold">notes</div>
					</Link>
					{isOnSearchPage ? null : (
						<div className="ml-auto max-w-sm flex-1">
							<SearchBar status="idle" />
						</div>
					)}
					<div className="flex items-center gap-10">
						{user ? (
							<div className="flex items-center gap-2">
								<Button asChild variant="secondary">
									<Link
										to={`/users/${user.username}`}
										className="flex items-center gap-2"
									>
										<img
											className="h-8 w-8 rounded-full object-cover"
											alt={user.name ?? user.username}
											src={getUserImgSrc(user.image?.id)}
										/>
										<span className="hidden text-body-sm font-bold sm:block">
											{user.name ?? user.username}
										</span>
									</Link>
								</Button>
								{userIsAdmin ? (
									<Button asChild variant="secondary">
										<Link to="/admin">
											<Icon name="backpack">
												<span className="hidden sm:block">Admin</span>
											</Icon>
										</Link>
									</Button>
								) : null}
							</div>
						) : (
							<Button asChild variant="default" size="sm">
								<Link to="/login">Log In</Link>
							</Button>
						)}
					</div>
				</nav>
			</header>

			<div className="flex-1">
				<Outlet />
			</div>

			<div className="container mx-auto flex justify-between">
				<Link to="/">
					<div className="font-light">epic</div>
					<div className="font-bold">notes</div>
				</Link>
				<div className="flex items-center gap-2">
					<p>Built with ♥️ by {data.username}</p>
					<ThemeSwitch userPreference={theme} />
				</div>
			</div>
			<Spacer size="3xs" />
			{data.toast ? <ShowToast toast={data.toast} /> : null}
		</Document>
	)
}

// useTheme hook reads the current theme from useLoaderData
// and returns it unless there's an ongoing fetcher setting the theme.
// The ThemeSwitch is using useFetcher to make the switch.
function useTheme() {
	const data = useLoaderData<typeof loader>()
	// Add a `.find` on the fetchers array to find the fetcher which has formData
	// with an intent of 'update-theme'. If that fetcher is found, then return the
	// 'theme' from the fetcher's formData.
	const fetchers = useFetchers()
	const themeFetcher = fetchers.find(
		f => f.formData?.get('intent') === 'update-theme',
	)
	// Get the value submitted by the user
	const optimisticTheme = themeFetcher?.formData?.get('theme')
	if (optimisticTheme === 'light' || optimisticTheme === 'dark') {
		return optimisticTheme
	}
	// Fallback to server provided value
	return data.theme
}

export default function AppWithProviders() {
	const data = useLoaderData<typeof loader>()
	return (
		<AuthenticityTokenProvider token={data.csrfToken}>
			<HoneypotProvider {...data.honeyProps}>
				<App />
			</HoneypotProvider>
		</AuthenticityTokenProvider>
	)
}

function Document({
	children,
	theme,
	env,
	// isLoggedIn = false,
}: {
	children: React.ReactNode
	theme?: Theme
	env?: Record<string, string>
	// isLoggedIn?: boolean
}) {
	return (
		<html lang="en" className={`${theme} h-full overflow-x-hidden`}>
			<head>
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<Links />
			</head>
			<body className="flex h-full flex-col justify-between bg-background text-foreground">
				{children}
				{/*
				Inline script here using dangerouslySetInnerHTML which
				sets window.ENV to the JSON.stringified value of data.ENV
			*/}
				<script
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				{/* {isLoggedIn ? <LogoutTimer /> : null} */}
				<Toaster closeButton position="top-center" />
				<ScrollRestoration />
				<Scripts />
				<LiveReload />
			</body>
		</html>
	)
}

function ThemeSwitch({ userPreference }: { userPreference?: Theme }) {
	const fetcher = useFetcher<typeof action>()

	const [form] = useForm({
		id: 'theme-switch',
		// set the lastSubmission to fetcher.data?.submission
		lastSubmission: fetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ThemeFormSchema })
		},
	})

	const mode = userPreference ?? 'light'
	// set the nextMode to the opposite of the current mode
	const nextMode = mode === 'light' ? 'dark' : 'light'
	const modeLabel = {
		light: (
			<Icon name="sun">
				<span className="sr-only">Light</span>
			</Icon>
		),
		dark: (
			<Icon name="moon">
				<span className="sr-only">Dark</span>
			</Icon>
		),
	}

	return (
		// change this to a fetcher.Form and set the method as POST
		<fetcher.Form method="POST" {...form.props}>
			<input type="hidden" name="theme" value={nextMode} />
			<div className="flex gap-2">
				<button
					name="intent"
					value="update-theme"
					type="submit"
					className="flex h-8 w-8 cursor-pointer items-center justify-center"
				>
					{modeLabel[mode]}
				</button>
			</div>
			<ErrorList errors={form.errors} id={form.errorId} />
		</fetcher.Form>
	)
}

/* Deactivate auto-logout
function LogoutTimer() {
	const [status, setStatus] = useState<'idle' | 'show-modal'>('idle')
	// bring in the location via useLocation so we can access location.key
	// get a submit function via useSubmit
	// normally you'd want these numbers to be much higher, but for the purpose
	// of this exercise, we'll make it short:
	const location = useLocation()
	const submit = useSubmit()
	const logoutTime = 5000
	const modalTime = 2000
	// here's what would be more likely:
	// const logoutTime = 1000 * 60 * 60;
	// const modalTime = logoutTime - 1000 * 60 * 2;
	const modalTimer = useRef<ReturnType<typeof setTimeout>>()
	const logoutTimer = useRef<ReturnType<typeof setTimeout>>()

	const logout = useCallback(() => {
		// call submit in here. The submit body can be null,
		// but the requestInit should be method POST and action '/logout'
		submit(null, { method: 'POST', action: '/logout' })
	}, [submit])

	const cleanupTimers = useCallback(() => {
		clearTimeout(modalTimer.current)
		clearTimeout(logoutTimer.current)
	}, [])

	const resetTimers = useCallback(() => {
		cleanupTimers()
		modalTimer.current = setTimeout(() => {
			setStatus('show-modal')
		}, modalTime)
		logoutTimer.current = setTimeout(logout, logoutTime)
	}, [cleanupTimers, logout, logoutTime, modalTime])

	// whenever the location changes, we want to reset the timers, so you
	// can add location.key to this array:
	useEffect(() => resetTimers(), [resetTimers, location.key])
	useEffect(() => cleanupTimers, [cleanupTimers])

	function closeModal() {
		setStatus('idle')
		resetTimers()
	}

	return (
		<AlertDialog
			aria-label="Pending Logout Notification"
			open={status === 'show-modal'}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you still there?</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogDescription>
					You are going to be logged out due to inactivity. Close this modal to
					stay logged in.
				</AlertDialogDescription>
				<AlertDialogFooter className="flex items-end gap-8">
					<AlertDialogCancel onClick={closeModal}>
						Remain Logged In
					</AlertDialogCancel>
					<Form method="POST" action="/logout">
						<AlertDialogAction type="submit">Logout</AlertDialogAction>
					</Form>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
*/

function ShowToast({ toast }: { toast: Toast }) {
	const { id, type, title, description } = toast

	useEffect(() => {
		setTimeout(() => {
			showToast[type](title, { id, description })
		}, 0)
	}, [description, id, title, type])
	return null
}

export function ErrorBoundary() {
	return (
		<Document>
			<div className="flex-1">
				<GeneralErrorBoundary />
			</div>
		</Document>
	)
}
