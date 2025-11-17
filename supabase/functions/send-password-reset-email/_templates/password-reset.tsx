import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22'
import * as React from 'https://esm.sh/react@18.3.1'

interface PasswordResetEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
}

export const PasswordResetEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your Showya password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Reset Your Password</Heading>
        <Text style={text}>
          We received a request to reset your password for your Showya account.
          Click the button below to create a new password:
        </Text>
        <Link
          href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          target="_blank"
          style={button}
        >
          Reset Password
        </Link>
        <Text style={{ ...text, marginTop: '32px' }}>
          Or copy and paste this link into your browser:
        </Text>
        <Text style={link}>
          {`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
        </Text>
        <Text style={{ ...text, marginTop: '32px', color: '#666' }}>
          If you didn't request a password reset, you can safely ignore this email.
          Your password will remain unchanged.
        </Text>
        <Text style={{ ...text, marginTop: '32px', color: '#666', fontSize: '12px' }}>
          This link will expire in 1 hour for security reasons.
        </Text>
        <Text style={footer}>
          <Link
            href="https://showya.app"
            target="_blank"
            style={{ ...link, color: '#898989' }}
          >
            Showya
          </Link>
          <br />
          Empowering artists and communities
        </Text>
      </Container>
    </Body>
  </Html>
)

export default PasswordResetEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  borderRadius: '8px',
  maxWidth: '600px',
}

const h1 = {
  color: '#262626',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0 0 24px',
  padding: '0',
  lineHeight: '1.3',
}

const text = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '16px 0',
}

const button = {
  backgroundColor: '#7c3aed',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '14px 24px',
  margin: '24px 0',
}

const link = {
  color: '#7c3aed',
  fontSize: '14px',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
}

const footer = {
  color: '#898989',
  fontSize: '12px',
  lineHeight: '1.6',
  marginTop: '48px',
  paddingTop: '24px',
  borderTop: '1px solid #e5e5e5',
  textAlign: 'center' as const,
}
