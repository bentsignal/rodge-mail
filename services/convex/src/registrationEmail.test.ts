import { afterEach, describe, expect, it, vi } from "vitest";

import { sendRegistrationEmail } from "./registrationEmail";

describe("sendRegistrationEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the registration code through Resend", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRegistrationEmail({
      apiKey: "resend-key",
      from: "Rodge Mail <auth@example.com>",
      otp: "123456",
      to: "person@example.com",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer resend-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Rodge Mail <auth@example.com>",
          to: ["person@example.com"],
          subject: "Your Rodge Mail verification code",
          text: "Your Rodge Mail verification code is 123456. It expires in 5 minutes.",
        }),
      }),
    );
  });

  it("fails when Resend rejects the email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    await expect(
      sendRegistrationEmail({
        apiKey: "resend-key",
        from: "Rodge Mail <auth@example.com>",
        otp: "123456",
        to: "person@example.com",
      }),
    ).rejects.toThrow("Resend rejected the verification email (403)");
  });
});
