from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints

RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True, from_attributes=True)


class SellerInput(ApiModel):
    business_name: RequiredText
    description: RequiredText


class OfferingInput(ApiModel):
    name: RequiredText
    description: RequiredText


class OfferingOutput(OfferingInput):
    id: int


class SellerOutput(ApiModel):
    business_name: str
    description: str
    offerings: list[OfferingOutput]


class ProspectInput(ApiModel):
    business_name: RequiredText
    email: EmailStr
    description: RequiredText
    contact_name: str = ""
    needs: str = ""


class ProspectOutput(ProspectInput):
    id: int


class UploadModel(BaseModel):
    # Source metadata and positional cells preserve exact original whitespace.
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=False, from_attributes=True)


DelimiterInput = Literal["auto", ",", ";", "\t"]
DelimiterOutput = Literal[",", ";", "\t"]


class UploadInput(UploadModel):
    filename: str
    content_base64: str
    delimiter: DelimiterInput
    has_headers: bool


class UploadPreviewOutput(UploadModel):
    headers: list[str] | None
    rows: list[list[str]]
    row_count: int
    column_count: int
    delimiter: DelimiterOutput
    requested_delimiter: DelimiterInput
    has_headers: bool
    truncated: bool
    warnings: list[str]


class UploadMetadataOutput(UploadModel):
    id: str
    filename: str
    uploaded_at: str
    status: Literal["Awaiting review"]
    delimiter: DelimiterOutput
    requested_delimiter: DelimiterInput
    has_headers: bool
    size_bytes: int
    row_count: int
    column_count: int


class UploadDetailOutput(UploadMetadataOutput):
    preview: UploadPreviewOutput


class UploadSettingsOutput(UploadModel):
    max_file_bytes: int
    preview_row_limit: int


class DashboardOutput(ApiModel):
    seller_complete: bool
    offering_count: int
    prospect_count: int


class HealthOutput(ApiModel):
    status: str


class ErrorDetail(ApiModel):
    message: str
    details: list[str]


class ErrorOutput(ApiModel):
    error: ErrorDetail
