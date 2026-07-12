interface SendRegistrationEmailOptions {
  apiKey: string;
  from: string;
  otp: string;
  to: string;
}

type SendRecoveryEmailOptions = SendRegistrationEmailOptions;

export async function sendRegistrationEmail({
  apiKey,
  from,
  otp,
  to,
}: SendRegistrationEmailOptions) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Rodge Mail verification code",
      text: `Your Rodge Mail verification code is ${otp}. It expires in 5 minutes.`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend rejected the verification email (${response.status})`,
    );
  }
}

export async function sendRecoveryEmail({
  apiKey,
  from,
  otp,
  to,
}: SendRecoveryEmailOptions) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Rodge Mail sign-in code",
      text: `Your Rodge Mail sign-in code is ${otp}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the sign-in email (${response.status})`);
  }
}
