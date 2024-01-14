import {
	redirect,
	type MetaFunction,
    type ActionFunctionArgs,
} from '@remix-run/node'
import { Form } from '@remix-run/react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export async function action({ request }: ActionFunctionArgs) {
	// 💣 you can remove this comment once you've used the form data
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const formData = await request.formData()
	// 🐨 throw a 400 response if the name field is filled out
	// we'll implement signup later
	return redirect('/')
}

export default function SignupRoute() {
	return (
		<div className="container flex min-h-full flex-col justify-center pb-32 pt-20">
			<div className="mx-auto w-full max-w-lg">
				<div className="flex flex-col gap-3 text-center">
					<h1 className="text-h1">Welcome aboard!</h1>
					<p className="text-body-md text-muted-foreground">
						Please enter your details.
					</p>
				</div>
				<Form
					method="POST"
					className="mx-auto flex min-w-[368px] max-w-sm flex-col gap-4"
				>
					{/* 🐨 render a hidden div with an "name" input */}
					{/* 🦉 think about the accessibility implications. */}
					{/* 💯 As extra credit, make sure screen readers will ignore this field */}
					{/*
						💯 As extra credit, add a label to tell the user to not fill out
						the field in case they somehow notice it.
					*/}
					<div>
						<Label htmlFor="email-input">Email</Label>
						<Input autoFocus id="email-input" name="email" type="email" />
					</div>
					<Button className="w-full" type="submit">
						Create an account
					</Button>
				</Form>
			</div>
		</div>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Setup Epic Notes Account' }]
}
