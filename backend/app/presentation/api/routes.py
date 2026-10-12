from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Path as PathParameter, Response
from fastapi.responses import FileResponse

from app.application.use_cases.sales import SalesUseCases
from app.application.use_cases.uploads import UploadUseCases
from app.application.uploads import CsvOptions
from app.domain.entities import Offering, Prospect
from app.presentation.api.schemas import (
    DashboardOutput, ErrorOutput, HealthOutput, OfferingInput, OfferingOutput,
    ProspectInput, ProspectOutput, SellerInput, SellerOutput, UploadDetailOutput,
    UploadInput, UploadMetadataOutput, UploadPreviewOutput, UploadSettingsOutput,
)

RecordId = Annotated[int, PathParameter(gt=0, le=9223372036854775807)]


def create_router(use_cases: SalesUseCases, uploads: UploadUseCases) -> APIRouter:
    router = APIRouter(prefix="/api", responses={404: {"model": ErrorOutput}, 422: {"model": ErrorOutput}, 500: {"model": ErrorOutput}})

    @router.get("/health", response_model=HealthOutput)
    def health():
        return {"status": "ok"}

    @router.get("/seller", response_model=SellerOutput)
    def get_seller():
        return use_cases.get_seller()

    @router.put("/seller", response_model=SellerOutput)
    def save_seller(payload: SellerInput):
        return use_cases.save_seller(payload.business_name, payload.description)

    @router.get("/offerings", response_model=list[OfferingOutput])
    def list_offerings():
        return use_cases.list_offerings()

    @router.post("/offerings", response_model=OfferingOutput, status_code=201)
    def add_offering(payload: OfferingInput):
        return use_cases.add_offering(Offering(**payload.model_dump()))

    @router.put("/offerings/{record_id}", response_model=OfferingOutput)
    def update_offering(record_id: RecordId, payload: OfferingInput):
        return use_cases.update_offering(record_id, Offering(**payload.model_dump()))

    @router.delete("/offerings/{record_id}", status_code=204)
    def delete_offering(record_id: RecordId):
        use_cases.delete_offering(record_id)
        return Response(status_code=204)

    @router.get("/uploads/settings", response_model=UploadSettingsOutput)
    def upload_settings():
        return uploads.settings

    @router.post("/uploads/preview", response_model=UploadPreviewOutput)
    def preview_upload(payload: UploadInput):
        return uploads.preview(payload.filename, payload.content_base64, CsvOptions(payload.delimiter, payload.has_headers))

    @router.post("/uploads", response_model=UploadDetailOutput, status_code=201)
    def save_upload(payload: UploadInput):
        return uploads.save(payload.filename, payload.content_base64, CsvOptions(payload.delimiter, payload.has_headers))

    @router.get("/uploads", response_model=list[UploadMetadataOutput])
    def list_uploads():
        return uploads.list()

    @router.get("/uploads/{source_id}", response_model=UploadDetailOutput)
    def get_upload(source_id: str):
        return uploads.get(source_id)

    @router.delete("/uploads/{source_id}", status_code=204)
    def delete_upload(source_id: str):
        uploads.delete(source_id)
        return Response(status_code=204)

    @router.get("/offerings/example.csv", response_class=FileResponse)
    def example_csv():
        example_path = Path(__file__).resolve().parents[3] / "examples" / "offerings.csv"
        return FileResponse(example_path, media_type="text/csv", filename="offerings-example.csv")

    @router.get("/prospects", response_model=list[ProspectOutput])
    def list_prospects():
        return use_cases.list_prospects()

    @router.post("/prospects", response_model=ProspectOutput, status_code=201)
    def add_prospect(payload: ProspectInput):
        return use_cases.add_prospect(Prospect(**payload.model_dump()))

    @router.put("/prospects/{record_id}", response_model=ProspectOutput)
    def update_prospect(record_id: RecordId, payload: ProspectInput):
        return use_cases.update_prospect(record_id, Prospect(**payload.model_dump()))

    @router.delete("/prospects/{record_id}", status_code=204)
    def delete_prospect(record_id: RecordId):
        use_cases.delete_prospect(record_id)
        return Response(status_code=204)

    @router.get("/dashboard", response_model=DashboardOutput)
    def dashboard():
        return use_cases.dashboard()

    return router
