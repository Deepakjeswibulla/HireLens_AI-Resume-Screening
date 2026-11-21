import { Link } from "react-router-dom";
import { BookOpen, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function Help() {
  return (
    <div>
      <PageHeader
        title="Help & documentation"
        subtitle="What HireLens measures, how each score is produced, and what it deliberately does not do."
        actions={
          <Button variant="outline" asChild>
            <a href="/api/docs" target="_blank" rel="noreferrer">
              <ExternalLink /> API reference
            </a>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>How a screening runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
            <p>1. The job description is parsed into required skills, preferred skills, responsibilities, minimum experience and education asks — all editable.</p>
            <p>2. Each resume is extracted (PyMuPDF for PDF, python-docx for DOCX) and parsed into a structured profile: contact details, skills with evidence zones, employment history with dates, education, projects and certifications.</p>
            <p>3. Four components are computed per candidate and combined into a 0–100 score. Every component keeps its evidence so the score can be explained.</p>
            <p>4. Candidates are ranked; you can filter, compare, shortlist and export. Nothing is auto-rejected.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scoring formula</CardTitle>
            <CardDescription>Weights live in one backend configuration file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px] leading-relaxed">
            <p className="rounded-md bg-muted/60 p-3 font-mono text-2xs">
              score = 0.40 × skills + 0.30 × semantic + 0.20 × experience + 0.10 × education
            </p>
            <p className="text-muted-foreground">
              Skills: required skills weigh 2× preferred ones; exact/alias matches score full credit, related skills get
              partial credit (≤45%), semantic-only evidence gets 25%. A skill demonstrated in work or projects scores
              slightly higher than one merely listed.
            </p>
            <p className="text-muted-foreground">
              Semantic: sentence embeddings compare each requirement passage with the best matching resume passage;
              cosine similarity is calibrated (0.15–0.58 → 0–100), never multiplied by 100. It cannot override explicit
              requirements because it is only 30% of the score.
            </p>
            <p className="text-muted-foreground">
              Experience: each role's months are weighted by how much of it overlaps the job; overlapping dates are
              merged and relevant years are compared with the stated minimum.
            </p>
            <p className="text-muted-foreground">
              Education: scored only when the job asks for a qualification and the resume yielded education data.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Missing information policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
            <p>
              If a component cannot be computed — no education requirement in the job, unparseable employment dates, no
              education section in the resume — it is excluded and the remaining weights are renormalised. The profile
              shows a "data completeness" figure and names the components that were not scored.
            </p>
            <p>Unknown is never treated as zero, and parser uncertainty is never reported as a missing skill.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What HireLens does not do</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
            <p>It does not use name, gender, age, location, phone or any protected attribute in scoring.</p>
            <p>It does not OCR scanned PDFs: if almost no text is extracted, the file is reported as unreadable instead of being scored.</p>
            <p>It does not fabricate achievements or call an LLM to write explanations — every sentence is assembled from extracted evidence.</p>
            <p>It does not decide anything for you. Labels such as "Strong Match" describe evidence, not a hiring decision.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <BookOpen className="size-4" /> Running it locally
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px] text-muted-foreground">
          <p>
            Backend: <code className="font-mono text-2xs">uvicorn app.main:app --reload --port 8000</code> from{" "}
            <code className="font-mono text-2xs">backend/</code>. Frontend:{" "}
            <code className="font-mono text-2xs">npm run dev</code> from <code className="font-mono text-2xs">frontend/</code>.
          </p>
          <p>
            The embedding model downloads on first analysis (about 90 MB) and is cached afterwards. Without it, semantic
            matching falls back to TF-IDF/SVD and says so in the header and on every candidate profile.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge tone="outline">FastAPI + SQLite</Badge>
            <Badge tone="outline">React + TypeScript</Badge>
            <Badge tone="outline">Sentence Transformers</Badge>
            <Badge tone="outline">No paid APIs</Badge>
          </div>
          <Button variant="outline" size="sm" asChild className="mt-2">
            <Link to="/screenings/new">Create a screening</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
