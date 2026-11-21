import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequirementEditor } from "@/components/screening/RequirementEditor";
import type { JobRequirements } from "@/types";

const INITIAL: JobRequirements = {
  required_skills: ["Python", "FastAPI"],
  preferred_skills: ["Docker"],
  responsibilities: ["Build REST APIs"],
  minimum_experience: 3,
  education_requirements: ["Bachelor's degree"],
  domain_requirements: ["Fintech"],
  raw_text: "",
};

function Harness() {
  const [value, setValue] = useState<JobRequirements>(INITIAL);
  return (
    <div>
      <RequirementEditor value={value} onChange={setValue} />
      <output data-testid="state">{JSON.stringify(value)}</output>
    </div>
  );
}

function state() {
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}") as JobRequirements;
}

describe("RequirementEditor", () => {
  it("adds a required skill", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Add a skill"), "PostgreSQL");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(state().required_skills).toContain("PostgreSQL");
  });

  it("moves a skill from required to preferred when clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "FastAPI" }));
    expect(state().required_skills).toEqual(["Python"]);
    expect(state().preferred_skills).toEqual(["Docker", "FastAPI"]);
  });

  it("removes a skill", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText("Remove Python"));
    expect(state().required_skills).toEqual(["FastAPI"]);
  });

  it("edits the minimum experience requirement", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Minimum experience (years)");
    await user.clear(input);
    await user.type(input, "5");
    expect(state().minimum_experience).toBe(5);
  });

  it("clears minimum experience when the field is emptied", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Minimum experience (years)");
    await user.clear(input);
    expect(state().minimum_experience).toBeNull();
  });

  it("shows extracted responsibilities", () => {
    render(<Harness />);
    expect(screen.getByText("Build REST APIs")).toBeInTheDocument();
  });
});
