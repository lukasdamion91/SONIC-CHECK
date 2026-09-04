export const FORMAL_LICENCE_REQUIRED = "formal_licence_required";

/** Fail closed unless the public product contract confirms both gates. */
export function commercialLicenseState(contract) {
  const gate = contract?.commercial_license_gate;
  const approved = gate?.approved === true && gate?.status === "approved";
  const checkoutOpen = approved
    && gate?.paid_traffic_authorized === true
    && contract?.paid_public_scanning === "enabled";

  if (!gate) {
    return {
      status: "unconfirmed",
      approved: false,
      checkoutOpen: false,
      label: "Commercial licence status unavailable",
      message: "Paid checkout remains closed unless the API confirms a reviewed formal commercial licence and separately authorizes paid traffic. Creating an account does not enable purchase or paid screening.",
    };
  }

  if (!approved) {
    return {
      status: gate.status || FORMAL_LICENCE_REQUIRED,
      approved: false,
      checkoutOpen: false,
      label: "Formal commercial licence required",
      message: "Paid checkout is closed pending a reviewed formal commercial licence. Creating an account does not enable purchase or paid screening.",
    };
  }

  if (!checkoutOpen) {
    return {
      status: gate.status,
      approved: true,
      checkoutOpen: false,
      label: "Paid checkout separately closed",
      message: "The formal commercial-licence gate is approved, but paid checkout remains closed until the API separately authorizes paid traffic. Creating an account does not itself grant an entitlement.",
    };
  }

  return {
    status: gate.status,
    approved: true,
    checkoutOpen: true,
    label: "Paid checkout API-authorized",
    message: "The API confirms the reviewed formal commercial-licence gate and paid-traffic authorization. Account creation alone still does not grant an entitlement.",
  };
}
