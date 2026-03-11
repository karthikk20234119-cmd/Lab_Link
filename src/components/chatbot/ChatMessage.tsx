import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

// Simple markdown renderer for chat messages
function renderMarkdown(text: string): JSX.Element {
  // Split into lines and process
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      if (listType === 'ol') {
        elements.push(
          <ol key={elements.length} className="list-decimal list-inside space-y-1 my-2 pl-2">
            {listItems.map((item, i) => <li key={i} className="text-sm">{processInline(item)}</li>)}
          </ol>
        );
      } else {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside space-y-1 my-2 pl-2">
            {listItems.map((item, i) => <li key={i} className="text-sm">{processInline(item)}</li>)}
          </ul>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  // Process inline formatting (bold, etc.)
  const processInline = (text: string): JSX.Element => {
    // Handle **bold**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Heading (## or ###)
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={index} className="font-semibold text-sm mt-3 mb-1 text-primary">
          {processInline(trimmed.replace('### ', ''))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={index} className="font-bold text-sm mt-3 mb-2 text-primary border-b pb-1">
          {processInline(trimmed.replace('## ', ''))}
        </h3>
      );
    }
    // Numbered list (1. 2. 3. or Step 1:)
    else if (/^(\d+[\.\):]|\*\*Step \d+)/.test(trimmed)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(trimmed.replace(/^\d+[\.\):]\s*/, '').replace(/^\*\*Step \d+[:\*]*\s*/, ''));
    }
    // Bullet list (- or • or *)
    else if (/^[-•\*]\s/.test(trimmed)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(trimmed.replace(/^[-•\*]\s*/, ''));
    }
    // Empty line
    else if (trimmed === '') {
      flushList();
    }
    // Regular paragraph
    else {
      flushList();
      elements.push(
        <p key={index} className="text-sm my-1">
          {processInline(trimmed)}
        </p>
      );
    }
  });

  flushList();
  return <>{elements}</>;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg",
        isAssistant ? "bg-muted/50" : "bg-primary/5"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isAssistant ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isAssistant ? (
          <Bot className="h-4 w-4" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 space-y-1 overflow-hidden">
        <p className="text-xs font-medium text-muted-foreground">
          {isAssistant ? "LabLink Assistant" : "You"}
        </p>
        <div className="text-sm leading-relaxed">
          {isAssistant ? renderMarkdown(content) : content}
        </div>
      </div>
    </div>
  );
}
