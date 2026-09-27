import type { ConfigFiles } from "../github/fetchConfigFiles";
import type { Guidelines } from "../github/fetchGuidelines";
import { extractConfigRules } from "./fromConfig";
import { extractProseRules, type ProseDoc } from "./fromProse";
import { extractTemplateRules } from "./fromTemplate";
import { findRelevantSections, type GuideSection } from "./sections";
import { CONFIDENCE_RANK, type Rule } from "./types";

export type ExtractedRules = {
    // Strongest first: config, then template, then prose
    rules: Rule[];
    // CONTRIBUTING parts to read yourself
    sections: GuideSection[];
    // Problems while reading config files, and "no rules found"
    warnings: string[];
};

// Turns the files fetched from GitHub into rules. No network and no AI:
// the same files always give the same rules, so this is easy to test.
export function extractRules(guidelines: Guidelines, configFiles: ConfigFiles): ExtractedRules {
    const warnings = [...configFiles.warnings];

    const fromConfig = extractConfigRules(configFiles.files);
    warnings.push(...fromConfig.warnings);

    const fromTemplate =
        guidelines.prTemplate !== null && guidelines.sources.prTemplate !== null
            ? extractTemplateRules(guidelines.prTemplate, guidelines.sources.prTemplate)
            : [];

    // CONTRIBUTING first, then the docs it links to
    const docs: ProseDoc[] = [];
    if (guidelines.contributing !== null && guidelines.sources.contributing !== null) {
        docs.push({ text: guidelines.contributing, fileUrl: guidelines.sources.contributing });
    }
    for (const doc of guidelines.extraDocs) docs.push({ text: doc.text, fileUrl: doc.source });

    // Array.sort keeps the original order for equal ranks, so each source
    // stays in file order
    const rules = [...fromConfig.rules, ...fromTemplate, ...extractProseRules(docs)].sort(
        (a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]
    );

    if (rules.length === 0) {
        const hasAnyFile = docs.length > 0 || guidelines.prTemplate !== null || configFiles.files.length > 0;
        warnings.push(
            hasAnyFile
                ? "No rules were found automatically. Please read the guideline sections below yourself."
                : "This repo has no CONTRIBUTING file, PR template or tool configs, so there are no repo rules to check."
        );
    }

    return { rules, sections: findRelevantSections(docs), warnings };
}
