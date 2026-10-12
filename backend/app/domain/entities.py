from dataclasses import dataclass


@dataclass
class Offering:
    name: str
    description: str


@dataclass
class SellerProfile:
    business_name: str
    description: str
    offerings: list[Offering]


@dataclass
class OfferingRecord(Offering):
    """An offering already saved in the catalog."""

    id: int


@dataclass
class Prospect:
    business_name: str
    email: str
    description: str
    contact_name: str = ""
    needs: str = ""


@dataclass
class ProspectRecord(Prospect):
    id: int = 0


@dataclass
class SourceMetadata:
    """A stored document's identity and format-independent attributes."""

    id: str
    filename: str
    uploaded_at: str
    attributes: dict[str, str | int | bool]


@dataclass
class StoredSource(SourceMetadata):
    content: bytes
