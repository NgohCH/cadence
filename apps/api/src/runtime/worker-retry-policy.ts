export type DeliveryRetryPolicy = (input: {
  processingAttempts: number;
  failedAt: string;
}) => string;

export function createDeliveryRetryPolicy(
  delaysSeconds: readonly number[],
): DeliveryRetryPolicy {
  if (
    delaysSeconds.length === 0 ||
    delaysSeconds.some(
      (delay) =>
        !Number.isInteger(delay) ||
        delay <= 0,
    )
  ) {
    throw new Error(
      "Delivery retry delays must contain positive integers.",
    );
  }

  return ({
    processingAttempts,
    failedAt,
  }) => {
    if (
      !Number.isInteger(processingAttempts) ||
      processingAttempts < 1
    ) {
      throw new Error(
        "Processing attempts must be a positive integer.",
      );
    }

    const failedAtDate = new Date(failedAt);

    if (Number.isNaN(failedAtDate.getTime())) {
      throw new Error(
        "Failed-at timestamp must be valid.",
      );
    }

    const delayIndex = Math.min(
      processingAttempts - 1,
      delaysSeconds.length - 1,
    );

    return new Date(
      failedAtDate.getTime() +
        delaysSeconds[delayIndex] * 1000,
    ).toISOString();
  };
}
