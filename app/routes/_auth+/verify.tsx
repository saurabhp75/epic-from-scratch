import { type Submission, conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { generateTOTP, verifyTOTP } from '@epic-web/totp'
import {
	json,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from '@remix-run/node'
import {
	Form,
	useActionData,
	useLoaderData,
	useSearchParams,
} from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms'
import { Spacer } from '~/components/spacer'
import { StatusButton } from '~/components/ui/status-button'
import { handleVerification as handleChangeEmailVerification } from '~/routes/settings+/profile.change-email'
import { validateCSRF } from '~/utils/csrf.server'
import { prisma } from '~/utils/db.server'
import { getDomainUrl, useIsPending } from '~/utils/misc'
import { type twoFAVerifyVerificationType } from '../settings+/profile.two-factor.verify'
import { handleVerification as handleLoginTwoFactorVerification } from './login'
import { handleVerification as handleOnboardingVerification } from './onboarding'
import { handleVerification as handleResetPasswordVerification } from './reset-password'

export const codeQueryParam = 'code'
export const targetQueryParam = 'target'
export const redirectToQueryParam = 'redirectTo'
export const typeQueryParam = 'type'

const types = ['onboarding', 'reset-password', 'change-email', '2fa'] as const
const VerificationTypeSchema = z.enum(types)
export type VerificationTypes = z.infer<typeof VerificationTypeSchema>

const VerifySchema = z.object({
	[codeQueryParam]: z.string().min(6).max(6),
	[targetQueryParam]: z.string(),
	[redirectToQueryParam]: z.string().optional(),
	[typeQueryParam]: VerificationTypeSchema,
})

export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	if (!params.has(codeQueryParam)) {
		// we don't want to show an error message on page load if the otp hasn't be
		// prefilled in yet, so we'll send a response with an empty submission.
		return json({
			status: 'idle',
			submission: {
				intent: '',
				payload: Object.fromEntries(params) as Record<string, unknown>,
				error: {} as Record<string, Array<string>>,
			},
		} as const)
	}
	return validateRequest(request, params)
}

export function getRedirectToUrl({
	request,
	type,
	target,
	redirectTo,
}: {
	request: Request
	type: VerificationTypes
	target: string
	redirectTo?: string
}) {
	const redirectToUrl = new URL(`${getDomainUrl(request)}/verify`)
	redirectToUrl.searchParams.set(typeQueryParam, type)
	redirectToUrl.searchParams.set(targetQueryParam, target)
	if (redirectTo) {
		redirectToUrl.searchParams.set(redirectToQueryParam, redirectTo)
	}
	return redirectToUrl
}

export async function prepareVerification({
	period,
	request,
	type,
	target,
	redirectTo: postVerificationRedirectTo,
}: {
	period: number
	request: Request
	type: VerificationTypes
	target: string
	redirectTo?: string
}) {
	// verifyUrl will contain "code" as search param along with
	// other params ("type", "target") and is emailed to the user.
	const verifyUrl = getRedirectToUrl({
		request,
		type,
		target,
		redirectTo: postVerificationRedirectTo,
	})
	const redirectTo = new URL(verifyUrl.toString())

	const { otp, ...verificationConfig } = generateTOTP({
		algorithm: 'SHA256',
		period,
	})

	const verificationData = {
		type,
		target,
		...verificationConfig,
		expiresAt: new Date(Date.now() + verificationConfig.period * 1000),
	}
	await prisma.verification.upsert({
		where: { target_type: { target, type } },
		create: verificationData,
		update: verificationData,
	})

	// add the otp to the url we'll email the user.
	verifyUrl.searchParams.set(codeQueryParam, otp)

	return { otp, redirectTo, verifyUrl }
}

export type VerifyFunctionArgs = {
	request: Request
	submission: Submission<z.infer<typeof VerifySchema>>
	body: FormData | URLSearchParams
}

export async function isCodeValid({
	code,
	type,
	target,
}: {
	code: string
	// we're not adding that type to the valid types in general because it's a temporary type
	type: VerificationTypes | typeof twoFAVerifyVerificationType
	target: string
}) {
	const verification = await prisma.verification.findUnique({
		where: {
			target_type: { target, type },
			OR: [{ expiresAt: { gt: new Date() } }, { expiresAt: null }],
		},
		select: { algorithm: true, secret: true, period: true, charSet: true },
	})
	if (!verification) return false
	const result = verifyTOTP({
		otp: code,
		secret: verification.secret,
		algorithm: verification.algorithm,
		period: verification.period,
		charSet: verification.charSet,
	})
	if (!result) return false

	return true
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	return validateRequest(request, formData)
}

async function validateRequest(
	request: Request,
	body: URLSearchParams | FormData,
) {
	const submission = await parse(body, {
		schema: () =>
			VerifySchema.superRefine(async (data, ctx) => {
				// console.log('verify this', data)
				// retrieve the verification secret, period, digits, charSet, and algorithm
				// by the target and type and ensure it's not expired
				// if there's no verification, then add an issue to the code field
				// that it's invalid (similar to the one below)
				// set codeIsValid to the result of calling verifyTOTP (from '@epic-web/totp')
				// with the verification config and the otp from the submitted data
				const codeIsValid = await isCodeValid({
					code: data[codeQueryParam],
					type: data[typeQueryParam],
					target: data[targetQueryParam],
				})
				if (!codeIsValid) {
					ctx.addIssue({
						path: ['code'],
						code: z.ZodIssueCode.custom,
						message: `Invalid code`,
					})
					return z.NEVER
				}
			}),

		async: true,
	})

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const { value: submissionValue } = submission

	async function deleteVerification() {
		await prisma.verification.delete({
			where: {
				target_type: {
					type: submissionValue[typeQueryParam],
					target: submissionValue[targetQueryParam],
				},
			},
		})
	}

	switch (submissionValue[typeQueryParam]) {
		case 'onboarding': {
			await deleteVerification()
			return handleOnboardingVerification({ request, body, submission })
		}
		case 'reset-password': {
			await deleteVerification()
			return handleResetPasswordVerification({ request, body, submission })
		}
		case 'change-email': {
			await deleteVerification()
			return handleChangeEmailVerification({ request, body, submission })
		}
		case '2fa': {
			return handleLoginTwoFactorVerification({ request, body, submission })
		}
	}
}

export default function VerifyRoute() {
	const data = useLoaderData<typeof loader>()
	const [searchParams] = useSearchParams()
	const isPending = useIsPending()
	const actionData = useActionData<typeof action>()

	const [form, fields] = useForm({
		id: 'verify-form',
		constraint: getFieldsetConstraint(VerifySchema),
		lastSubmission: actionData?.submission ?? data.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: VerifySchema })
		},
		defaultValue: {
			code: searchParams.get(codeQueryParam) ?? '',
			type: searchParams.get(typeQueryParam) ?? '',
			target: searchParams.get(targetQueryParam) ?? '',
			redirectTo: searchParams.get(redirectToQueryParam) ?? '',
		},
	})

	return (
		<div className="container flex flex-col justify-center pb-32 pt-20">
			<div className="text-center">
				<h1 className="text-h1">Check your email</h1>
				<p className="mt-3 text-body-md text-muted-foreground">
					We've sent you a code to verify your email address.
				</p>
			</div>

			<Spacer size="xs" />

			<div className="mx-auto flex w-72 max-w-full flex-col justify-center gap-1">
				<div>
					<ErrorList errors={form.errors} id={form.errorId} />
				</div>
				<div className="flex w-full gap-2">
					<Form method="POST" {...form.props} className="flex-1">
						<AuthenticityTokenInput />
						<Field
							labelProps={{
								htmlFor: fields[codeQueryParam].id,
								children: 'Code',
							}}
							inputProps={conform.input(fields[codeQueryParam])}
							errors={fields[codeQueryParam].errors}
						/>
						<input
							{...conform.input(fields[typeQueryParam], { type: 'hidden' })}
						/>
						<input
							{...conform.input(fields[targetQueryParam], { type: 'hidden' })}
						/>
						<input
							{...conform.input(fields[redirectToQueryParam], {
								type: 'hidden',
							})}
						/>
						<StatusButton
							className="w-full"
							status={isPending ? 'pending' : actionData?.status ?? 'idle'}
							type="submit"
							disabled={isPending}
						>
							Submit
						</StatusButton>
					</Form>
				</div>
			</div>
		</div>
	)
}
