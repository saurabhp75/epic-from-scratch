import os from 'node:os'
import { cssBundleHref } from '@remix-run/css-bundle'
import {
	type LinksFunction,
	json,
	type MetaFunction,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import {
	Link,
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from '@remix-run/react'

import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import faviconAssetUrl from './assets/favicon.svg'
import { GeneralErrorBoundary } from './components/error-boundary'
import fontStylesheetUrl from './styles/font.css'
import tailwindStylesheetUrl from './styles/tailwind.css'
import { csrf } from './utils/csrf.server'
import { getEnv } from './utils/env.server'
import { honeypot } from './utils/honeypot.server'

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
	return json(
		{ username: os.userInfo().username, ENV: getEnv(), honeyProps, csrfToken },
		{
			headers: csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : {},
		},
	)
}

function App() {
	const data = useLoaderData<typeof loader>()
	return (
		<Document>
			<header className="container mx-auto py-6">
				<nav className="flex justify-between">
					<Link to="/">
						<div className="font-light">epic</div>
						<div className="font-bold">notes</div>
					</Link>
					<Link className="underline" to="/signup">
						Signup
					</Link>
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
				<p>Built with ♥️ by {data.username}</p>
			</div>
			<div className="h-5" />
			<script
				dangerouslySetInnerHTML={{
					__html: `window.ENV = ${JSON.stringify(data.ENV)}`,
				}}
			/>
		</Document>
	)
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

function Document({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="h-full overflow-x-hidden">
			<head>
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<Links />
			</head>
			<body className="flex h-full flex-col justify-between bg-background text-foreground">
				{children}
				<ScrollRestoration />
				<Scripts />
				<LiveReload />
			</body>
		</html>
	)
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
