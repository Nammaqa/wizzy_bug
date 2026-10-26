export const isValidEmailAddress = (email: string): boolean => {
  const atIndex = email.indexOf("@");
  if (
    atIndex <= 0 ||
    atIndex !== email.lastIndexOf("@") ||
    email.length > 254
  ) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const domainLabels = domain.split(".");

  return (
    localPart.length <= 64 &&
    !localPart.includes("..") &&
    /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?$/.test(localPart) &&
    domain.length <= 253 &&
    domainLabels.length >= 2 &&
    domainLabels.every(
      (label) =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  );
};
