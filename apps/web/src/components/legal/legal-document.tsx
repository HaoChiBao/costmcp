import {
  StaticPage,
  StaticPageHeader,
  StaticPageSection,
} from "@/components/marketing/static-page";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  list?: string[];
};

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
};

export function LegalDocument({ eyebrow, title, updated, intro, sections }: LegalDocumentProps) {
  return (
    <StaticPage>
      <StaticPageHeader
        eyebrow={eyebrow}
        title={title}
        meta={`Last updated ${updated}`}
        intro={intro}
      />

      {sections.map((section) => (
        <StaticPageSection key={section.title} title={section.title}>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="static-page__copy">
              {paragraph}
            </p>
          ))}
          {section.list ? (
            <ul className="static-page__list">
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </StaticPageSection>
      ))}
    </StaticPage>
  );
}
