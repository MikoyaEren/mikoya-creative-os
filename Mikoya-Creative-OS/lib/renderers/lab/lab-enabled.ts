/** The Template Lab is a development tool: off in production unless explicitly enabled. */
export const labEnabled = () => process.env.NODE_ENV !== "production" || process.env.CREATIVE_OS_TEMPLATE_LAB === "1";
