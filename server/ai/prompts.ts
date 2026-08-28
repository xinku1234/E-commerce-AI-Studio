export function buildEcommerceImagePrompt(options: {
  prompt: string;
  negativePrompt?: string;
  productName?: string;
  platform?: string;
  aspectRatio?: string;
  hasReferenceImages?: boolean;
}): string {
  const {
    prompt,
    negativePrompt,
    productName = 'the supplied product',
    platform = 'general e-commerce',
    aspectRatio = '1:1',
    hasReferenceImages = false
  } = options;
  const referenceBlock = hasReferenceImages
    ? 'REFERENCE PRESERVATION: use the supplied product photos as the identity source; preserve exact silhouette, proportions, colors, materials, labels, ports, buttons, seams, and construction. Do not redesign, merge, or invent product variants.'
    : 'PRODUCT IDENTITY: depict one clearly readable product with coherent geometry and realistic materials. Do not invent brand marks or product variants.';

  return [
    'E-COMMERCE IMAGE PROMPT v1',
    `SUBJECT: ${productName}`,
    `OBJECTIVE: create a polished commercial product image for ${platform}.`,
    referenceBlock,
    `COMPOSITION: ${prompt}. Use a deliberate ${aspectRatio} composition, stable horizon, clear subject separation, and a visually simple background.`,
    'LIGHTING AND MATERIAL: physically plausible studio or lifestyle lighting, accurate material response, grounded contact shadow, clean edges, no accidental reflections.',
    `PLATFORM CONSTRAINTS: output ratio ${aspectRatio}; keep the product as the visual priority; reserve safe margins for platform UI or later copy overlays; do not render promotional text unless explicitly requested.`,
    `NEGATIVE CONSTRAINTS: ${negativePrompt || 'blurry, distorted geometry, duplicate objects, extra parts, warped logos, watermark, illegible text, cluttered background, overexposure'}`
  ].join('\n');
}
