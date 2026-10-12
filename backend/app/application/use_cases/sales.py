from app.application.ports import SalesRepository
from app.domain.entities import (
    Offering, OfferingRecord, Prospect, ProspectRecord, SellerProfile,
)


class SalesUseCases:
    """Local seller setup and catalog workflows; no HTTP or storage details."""

    def __init__(self, repository: SalesRepository):
        self.repository = repository

    def get_seller(self) -> SellerProfile:
        return self.repository.get_seller()

    def save_seller(self, business_name: str, description: str) -> SellerProfile:
        return self.repository.save_seller(business_name, description)

    def list_offerings(self) -> list[OfferingRecord]:
        return self.repository.list_offerings()

    def add_offering(self, offering: Offering) -> OfferingRecord:
        return self.repository.add_offering(offering)

    def update_offering(self, record_id: int, offering: Offering) -> OfferingRecord:
        return self.repository.update_offering(record_id, offering)

    def delete_offering(self, record_id: int) -> None:
        self.repository.delete_offering(record_id)

    def list_prospects(self) -> list[ProspectRecord]:
        return self.repository.list_prospects()

    def add_prospect(self, prospect: Prospect) -> ProspectRecord:
        return self.repository.add_prospect(prospect)

    def update_prospect(self, record_id: int, prospect: Prospect) -> ProspectRecord:
        return self.repository.update_prospect(record_id, prospect)

    def delete_prospect(self, record_id: int) -> None:
        self.repository.delete_prospect(record_id)

    def dashboard(self) -> dict[str, bool | int]:
        seller = self.repository.get_seller()
        offering_count, prospect_count = self.repository.counts()
        return {
            "seller_complete": bool(seller.business_name.strip() and seller.description.strip()),
            "offering_count": offering_count,
            "prospect_count": prospect_count,
        }
