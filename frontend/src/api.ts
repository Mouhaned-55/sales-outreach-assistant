export type OfferingInput = { name: string; description: string };
export type Offering = OfferingInput & { id: number };
export type Seller = {
  business_name: string;
  description: string;
  offerings: Offering[];
};
export type ProspectInput = {
  business_name: string;
  contact_name: string;
  email: string;
  description: string;
  needs: string;
};
export type Prospect = ProspectInput & { id: number };
export type Dashboard = {
  seller_complete: boolean;
  offering_count: number;
  prospect_count: number;
};
export type Delimiter = "auto" | "," | ";" | "\t";
export type UploadSettings = {
  max_file_bytes: number;
  preview_row_limit: number;
};
export type UploadPreview = {
  headers: string[] | null;
  rows: string[][];
  row_count: number;
  column_count: number;
  delimiter: Exclude<Delimiter, "auto">;
  requested_delimiter: Delimiter;
  has_headers: boolean;
  truncated: boolean;
  warnings: string[];
};
export type StagedUpload = {
  id: string;
  filename: string;
  uploaded_at: string;
  status: "Awaiting review";
  delimiter: Exclude<Delimiter, "auto">;
  requested_delimiter: Delimiter;
  has_headers: boolean;
  size_bytes: number;
  row_count: number;
  column_count: number;
};
export type UploadDetail = StagedUpload & { preview: UploadPreview };

export async function request<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers:
        data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new Error(
      "Cannot reach your workspace. Check that the local backend is running, then try again.",
    );
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please try again.`;
    try {
      const body = await response.json();
      if (body.error?.message) {
        message = body.error.message;
        if (Array.isArray(body.error.details) && body.error.details.length) {
          message += `\n${body.error.details.join("\n")}`;
        }
      }
    } catch {
      /* A proxy can return a non-JSON error when the backend is offline. */
    }
    if (response.status === 500 || response.status === 502) {
      message += "\nCheck that the local backend is running.";
    }
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
