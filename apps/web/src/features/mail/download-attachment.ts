export async function downloadAttachmentFile({
  fileName,
  url,
}: {
  fileName: string;
  url: string;
}) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Attachment download failed with ${response.status}`);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.download = fileName;
  link.href = objectUrl;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
