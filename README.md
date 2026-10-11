# Sales Outreach Assistant

A project for learning Python and agentic engineering, designed to support any
seller business. Eventually, seller and prospect information will help draft a
tailored sales email, present it for human approval, and send the approved draft.
This initial skeleton only prints a welcome message.

## Clean Architecture

- `app/domain/`: business entities and rules, independent of external libraries.
- `app/application/`: use cases and ports (interfaces for external capabilities);
  depends on the domain.
- `app/infrastructure/`: concrete implementations of application ports.
- `app/presentation/`: terminal input/output and calls to application use cases.
- `app/main.py`: composition root that connects components; currently calls the CLI.
- `tests/`: reserved for future tests.

Dependencies point inward: presentation and infrastructure depend on application,
and application depends on domain. The domain does not depend on outer layers.
Application code depends on ports it defines, not on infrastructure implementations.
The composition root wires the layers together.

## Run

From the project directory, with the existing virtual environment activated:

```bash
python -m app.main
```

Without activating the environment:

```bash
.venv/bin/python -m app.main
```

Only Python's standard library is needed. `requirements.txt` and `.env.example`
are intentionally empty.

`data/seller_profile.json` contains an empty JSON object (`{}`). We will define
the business fields in the next lesson.
# sales-outreach-assistant
