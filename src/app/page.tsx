"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Sender = "agent" | "user";

type Message = {
  id: string;
  sender: Sender;
  text: string;
  timestamp: number;
};

type StepKey = "intent" | "location" | "budget" | "propertyType" | "timeline";

type LeadDetails = {
  intent?: "Buy" | "Rent";
  location?: string;
  budgetInput?: string;
  budgetRange?: {
    min?: number;
    max?: number;
  };
  propertyType?: string;
  timeline?: string;
};

type PropertyOption = {
  id: string;
  intent: "Buy" | "Rent";
  location: string;
  locationTag: string;
  type: string;
  price: number;
  priceDisplay: string;
  benefit: string;
  status: string;
};

const questionFlow: { key: StepKey; prompt: string }[] = [
  {
    key: "intent",
    prompt: "Are you looking to Buy or Rent?",
  },
  {
    key: "location",
    prompt: "Which location or area do you prefer?",
  },
  {
    key: "budget",
    prompt: "What is your budget range?",
  },
  {
    key: "propertyType",
    prompt: "Property type? (1BHK / 2BHK / 3BHK / Villa / Plot / Commercial)",
  },
  {
    key: "timeline",
    prompt: "When are you planning to finalize? (Immediate / 1–3 months / Just exploring)",
  },
];

const propertyCatalog: PropertyOption[] = [
  {
    id: "andheri-buy-2bhk",
    intent: "Buy",
    location: "Andheri West",
    locationTag: "andheri",
    type: "2BHK",
    price: 14500000,
    priceDisplay: "₹1.45 Cr",
    benefit: "DN Nagar metro se 5 min walk, ready to move",
    status: "Ready",
  },
  {
    id: "powai-buy-3bhk",
    intent: "Buy",
    location: "Powai Lakefront",
    locationTag: "powai",
    type: "3BHK",
    price: 23000000,
    priceDisplay: "₹2.3 Cr",
    benefit: "Lake view + premium club amenities",
    status: "New Launch",
  },
  {
    id: "thane-buy-2bhk",
    intent: "Buy",
    location: "Thane Ghodbunder Road",
    locationTag: "thane",
    type: "2BHK",
    price: 11800000,
    priceDisplay: "₹1.18 Cr",
    benefit: "Upcoming metro connectivity + clubhouse",
    status: "Under Construction",
  },
  {
    id: "chembur-buy-1bhk",
    intent: "Buy",
    location: "Chembur East",
    locationTag: "chembur",
    type: "1BHK",
    price: 9500000,
    priceDisplay: "₹95 Lakh",
    benefit: "Chembur mono rail ke bilkul pass",
    status: "Ready",
  },
  {
    id: "andheri-rent-2bhk",
    intent: "Rent",
    location: "Andheri East",
    locationTag: "andheri",
    type: "2BHK",
    price: 65000,
    priceDisplay: "₹65K / month",
    benefit: "Fully furnished, corporate hubs ke close",
    status: "Ready",
  },
  {
    id: "thane-rent-3bhk",
    intent: "Rent",
    location: "Thane Hiranandani Estate",
    locationTag: "thane",
    type: "3BHK",
    price: 95000,
    priceDisplay: "₹95K / month",
    benefit: "Large carpet + international school next door",
    status: "Ready",
  },
  {
    id: "bandra-rent-1bhk",
    intent: "Rent",
    location: "Bandra West",
    locationTag: "bandra",
    type: "1BHK",
    price: 85000,
    priceDisplay: "₹85K / month",
    benefit: "Turn-key apartment, Hill Road ke paas",
    status: "Ready",
  },
];

const propertyTypeValues = ["1BHK", "2BHK", "3BHK", "VILLA", "PLOT", "COMMERCIAL"];

let messageCounter = 0;
const createMessageId = () => {
  messageCounter += 1;
  return `msg-${messageCounter}`;
};

const getNow = () => Date.now();

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const matchIntent = (value: string | undefined): "Buy" | "Rent" | undefined => {
  if (!value) return undefined;
  if (value.toLowerCase().includes("buy")) return "Buy";
  if (value.toLowerCase().includes("rent")) return "Rent";
  if (value.toLowerCase().includes("own")) return "Buy";
  return undefined;
};

const parseBudgetRange = (input: string | undefined) => {
  if (!input) return undefined;
  const normalized = input.replace(/,/g, "").toLowerCase();
  const matches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(crore|cr|crores|lakh|lac|l|k|thousand|million|m)?/g)];
  if (matches.length === 0) return undefined;
  const values = matches
    .map((match) => {
      const numeric = parseFloat(match[1]);
      const unit = match[2];
      if (Number.isNaN(numeric)) return undefined;
      switch (unit) {
        case "crore":
        case "crores":
        case "cr":
          return numeric * 10000000;
        case "lakh":
        case "lac":
        case "l":
          return numeric * 100000;
        case "k":
        case "thousand":
          return numeric * 1000;
        case "million":
        case "m":
          return numeric * 1000000;
        default:
          return numeric;
      }
    })
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return {
      min,
      max,
    };
  }
  return { min, max };
};

const formatTimeline = (input: string | undefined) => {
  if (!input) return undefined;
  const normalized = input.toLowerCase();
  if (normalized.includes("immediate") || normalized.includes("urgent")) {
    return "Immediate";
  }
  if (normalized.match(/1\s*-\s*3|1-3|1\s*to\s*3/)) {
    return "1–3 months";
  }
  if (normalized.includes("just") || normalized.includes("explor")) {
    return "Just exploring";
  }
  if (normalized.includes("3") || normalized.includes("months")) {
    return "1–3 months";
  }
  return toTitleCase(input);
};

const getPropertyType = (input: string | undefined) => {
  if (!input) return undefined;
  const upper = input.toUpperCase();
  const matched = propertyTypeValues.find((type) => upper.includes(type));
  if (!matched) return toTitleCase(input);
  if (matched === "VILLA" || matched === "PLOT" || matched === "COMMERCIAL") {
    return matched.charAt(0) + matched.slice(1).toLowerCase();
  }
  return matched;
};

const friendlyLocation = (input: string | undefined) => {
  if (!input) return undefined;
  return input
    .split(",")
    .map((chunk) => toTitleCase(chunk.trim()))
    .join(", ");
};

const summarizeRequirement = (lead: LeadDetails) => {
  const parts: string[] = [];
  if (lead.propertyType) {
    parts.push(lead.propertyType);
  }
  if (lead.location) {
    parts.push(`in ${lead.location}`);
  }
  if (lead.intent) {
    parts.push(`for ${lead.intent.toLowerCase()}`);
  }
  if (lead.budgetInput) {
    parts.push(`under ${lead.budgetInput}`);
  }
  return parts.join(" ");
};

const pickRecommendations = (lead: LeadDetails): PropertyOption[] => {
  const intent = lead.intent ?? "Buy";
  const propertyType = lead.propertyType?.toUpperCase();
  const locationKey = lead.location?.toLowerCase() ?? "";
  const budget = lead.budgetRange;

  const filtered = propertyCatalog
    .filter((property) => property.intent === intent)
    .map((property) => {
      const matchesLocation =
        locationKey.length === 0 ||
        property.location.toLowerCase().includes(locationKey) ||
        property.locationTag.toLowerCase().includes(locationKey);
      const matchesType = !propertyType || property.type.toUpperCase().includes(propertyType);
      const matchesBudget =
        !budget ||
        !budget.max ||
        (intent === "Buy" ? property.price <= budget.max * 1.1 : property.price <= budget.max * 1.1);
      return {
        property,
        score:
          (matchesLocation ? 2 : 0) +
          (matchesType ? 2 : 0) +
          (matchesBudget ? 2 : 0) -
          Math.abs((budget?.min ?? property.price) - property.price) / (intent === "Buy" ? 1000000 : 5000),
        matchesLocation,
        matchesType,
        matchesBudget,
      };
    })
    .filter(({ matchesLocation, matchesType, matchesBudget }) => matchesLocation || matchesType || matchesBudget)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ property }) => property);

  if (filtered.length > 0) return filtered;

  return propertyCatalog.filter((property) => property.intent === intent).slice(0, 3);
};

const initialGreeting = `Hi 👋 Welcome! I’ll help you find the best property.\nLet’s start with a few quick questions.`;

const laterKeywords = ["later", "not now", "baad", "baadme", "baad mein", "after some time", "busy"];

const updateLeadDetails = (previous: LeadDetails, step: StepKey, answer: string): LeadDetails => {
  switch (step) {
    case "intent": {
      const intent = matchIntent(answer);
      if (!intent) return previous;
      return { ...previous, intent };
    }
    case "location": {
      return { ...previous, location: friendlyLocation(answer) };
    }
    case "budget": {
      return {
        ...previous,
        budgetInput: answer,
        budgetRange: parseBudgetRange(answer),
      };
    }
    case "propertyType": {
      return { ...previous, propertyType: getPropertyType(answer) };
    }
    case "timeline": {
      return { ...previous, timeline: formatTimeline(answer) };
    }
    default:
      return previous;
  }
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: createMessageId(),
      sender: "agent",
      text: initialGreeting,
      timestamp: getNow(),
    },
    {
      id: createMessageId(),
      sender: "agent",
      text: questionFlow[0].prompt,
      timestamp: getNow(),
    },
  ]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>("");
  const [lead, setLead] = useState<LeadDetails>({});
  const [ctaSentAt, setCtaSentAt] = useState<number | null>(null);
  const [followUpHandled, setFollowUpHandled] = useState<boolean>(false);
  const [lastRecommendations, setLastRecommendations] = useState<PropertyOption[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!ctaSentAt || followUpHandled) return;
    const timer = window.setTimeout(() => {
      setMessages((existing) => [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: "Just checking in 😊\nSite visit schedule karne mein help karu? Ya updated options bheju?",
          timestamp: getNow(),
        },
      ]);
      setFollowUpHandled(true);
    }, 35000);
    return () => window.clearTimeout(timer);
  }, [ctaSentAt, followUpHandled]);

  const handleUserInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isProcessing) return;

    setMessages((existing) => [
      ...existing,
      {
        id: createMessageId(),
        sender: "user",
        text: trimmed,
        timestamp: getNow(),
      },
    ]);
    setInputValue("");
    setIsProcessing(true);

    if (ctaSentAt && !followUpHandled) {
      setFollowUpHandled(true);
    }

    const nextStepIndex = currentStep;
    const currentQuestion = questionFlow[nextStepIndex];
    let updatedLead = lead;

    if (currentQuestion) {
      updatedLead = updateLeadDetails(lead, currentQuestion.key, trimmed);
      setLead(updatedLead);
    }

    if (!currentQuestion) {
      handlePostQualification(trimmed, updatedLead);
      return;
    }

    window.setTimeout(() => {
      continueFlow(trimmed, currentQuestion?.key, updatedLead);
    }, 300);
  };

  const continueFlow = (userReply: string, stepKey: StepKey | undefined, latestLead: LeadDetails) => {
    const nextIndex = currentStep + 1;
    if (stepKey === "timeline") {
      shareSummaryAndOptions(latestLead);
      setCurrentStep(nextIndex);
      setIsProcessing(false);
      return;
    }

    const containsLater = laterKeywords.some((word) => userReply.toLowerCase().includes(word));
    if (containsLater) {
      setMessages((existing) => [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: "Theek hai 👍 Main details note kar raha hoon. Jab ready ho, bas bata dena, main turant options share karunga.",
          timestamp: getNow(),
        },
      ]);
      setCtaSentAt(getNow());
      setFollowUpHandled(false);
      setIsProcessing(false);
      return;
    }

    if (questionFlow[nextIndex]) {
      setMessages((existing) => [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: questionFlow[nextIndex].prompt,
          timestamp: getNow(),
        },
      ]);
      setCurrentStep(nextIndex);
      setIsProcessing(false);
      return;
    }

    shareSummaryAndOptions(latestLead);
    setCurrentStep(nextIndex);
    setIsProcessing(false);
  };

  const shareSummaryAndOptions = (details: LeadDetails) => {
    const summary = summarizeRequirement(details);
    const summaryText =
      summary.length > 0
        ? `Perfect 👍\nSo you’re looking for ${summary}.`
        : "Great 👍 Let me note down what you're searching for.";

    const recommendations = pickRecommendations(details);
    const recommendationText =
      recommendations.length > 0
        ? `Here are the best options matching your requirement 👇\n${recommendations
            .map(
              (option) =>
                `• ${option.location} – ${option.priceDisplay} – ${option.benefit} (${option.status})`,
            )
            .join("\n")}`
        : "Currently exact match nahi mila, but main fresh inventory line up kar raha hoon.";

    const timelineLine = details.timeline ? `\nTimeline noted: ${details.timeline}.` : "";

    setMessages((existing) => {
      const timestamp = getNow();
      return [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: `${summaryText}${timelineLine}`,
          timestamp,
        },
        {
          id: createMessageId(),
          sender: "agent",
          text: recommendationText,
          timestamp,
        },
        {
          id: createMessageId(),
          sender: "agent",
          text: "Would you like to schedule a site visit or get more details on any option?",
          timestamp,
        },
      ];
    });
    setLastRecommendations(recommendations);
    setCtaSentAt(getNow());
    setFollowUpHandled(false);
  };

  const handlePostQualification = (reply: string, latestLead: LeadDetails) => {
    const lower = reply.toLowerCase();
    if (laterKeywords.some((word) => lower.includes(word))) {
      setMessages((existing) => [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: "Bilkul, koi tension nahi 😊 Jab bhi free ho, bas ping kar dena. Main fresh options ready rakhunga.",
          timestamp: getNow(),
        },
      ]);
      setCtaSentAt(getNow());
      setFollowUpHandled(false);
      setIsProcessing(false);
      return;
    }

    const visitKeywords = ["visit", "site", "tour", "see property"];
    if (visitKeywords.some((word) => lower.includes(word))) {
      setMessages((existing) => [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: "Amazing! Kaunsi date aur time convenient rahega? Weekend morning ya weekday evening arrange kar du?",
          timestamp: getNow(),
        },
      ]);
      setFollowUpHandled(true);
      setIsProcessing(false);
      return;
    }

    const optionMatch = lower.match(/option\s*(\d)/) ?? lower.match(/\b(\d)\b/);
    if (optionMatch) {
      const index = Number(optionMatch[1]) - 1;
      const chosen = lastRecommendations[index];
      if (chosen) {
        setMessages((existing) => [
          ...existing,
          {
            id: createMessageId(),
            sender: "agent",
            text: `${chosen.location} ke liye quick details 👇\n• Status: ${chosen.status}\n• Key benefit: ${chosen.benefit}\n• Pricing: ${chosen.priceDisplay}\nAapko walkthrough ya brochure bheju?`,
            timestamp: getNow(),
          },
        ]);
        setFollowUpHandled(true);
        setIsProcessing(false);
        return;
      }
    }

    if (lower.includes("detail") || lower.includes("more info")) {
      const topOption = lastRecommendations[0];
      const detailText = topOption
        ? `${topOption.location} project mein ${topOption.benefit}. Pricing ${topOption.priceDisplay} hai. Floor plan ya brochure share karu?`
        : "Main turant developer se updated details la sakta hoon. Kaunsi location pe focus karu?";
      setMessages((existing) => [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: detailText,
          timestamp: getNow(),
        },
      ]);
      setFollowUpHandled(true);
      setIsProcessing(false);
      return;
    }

    if (latestLead.location) {
      setMessages((existing) => [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: `Great! ${latestLead.location} area ke liye main team ko alert kar raha hoon. Koi specific project ka naam ya builder prefer karte ho?`,
          timestamp: getNow(),
        },
      ]);
    } else {
      setMessages((existing) => [
        ...existing,
        {
          id: createMessageId(),
          sender: "agent",
          text: "Sure 👍 Bas batao kaunsa option pasand aaya ya koi aur area explore karna hai. Main turant arrange kar dunga.",
          timestamp: getNow(),
        },
      ]);
    }
    setFollowUpHandled(true);
    setIsProcessing(false);
  };

  const pendingQuestion = useMemo(() => questionFlow[currentStep]?.prompt, [currentStep]);

  return (
    <main className="flex min-h-screen w-full justify-center bg-slate-100 py-10 text-slate-800">
      <div className="flex w-full max-w-3xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl bg-white/70 px-6 py-5 shadow-sm backdrop-blur">
          <h1 className="text-xl font-semibold text-slate-900">AgentConnect Realty</h1>
          <p className="mt-1 text-sm text-slate-600">
            Friendly real estate expert helping you shortlist &amp; book site visits in Mumbai.
          </p>
        </header>

        <section className="flex flex-1 flex-col overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "agent" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    message.sender === "agent"
                      ? "bg-blue-50 text-slate-800"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form
            className="border-t border-slate-100 bg-white px-4 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleUserInput(inputValue);
            }}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <input
                type="text"
                placeholder={pendingQuestion ?? "Type your reply"}
                className="h-11 flex-1 border-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleUserInput(inputValue);
                  }
                }}
                disabled={isProcessing}
              />
              <button
                type="submit"
                className="inline-flex h-10 w-28 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                disabled={!inputValue.trim() || isProcessing}
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Ask one detail at a time. Main saare answers note kar raha hoon ✅
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
