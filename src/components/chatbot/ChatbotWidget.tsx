import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  sendChatMessage,
  streamChatMessage,
  isOffTopicRequest,
  getOffTopicResponse,
  ChatMessage as ChatMessageType,
} from "@/services/chatbotService";
import { ChatMessage } from "./ChatMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Minimize2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatbotWidget() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm LabLink Assistant. I can help you with:\n\n• Finding items in the inventory\n• Understanding how to borrow items\n• Checking item availability\n• Answering questions about categories and departments\n\nHow can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestInProgress = useRef(false);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user || requestInProgress.current)
      return;

    const userMessage = input.trim();
    setInput("");
    requestInProgress.current = true;

    // Add user message to chat
    const newUserMessage: ChatMessageType = {
      role: "user",
      content: userMessage,
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // Check for off-topic requests
    if (isOffTopicRequest(userMessage)) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: getOffTopicResponse() },
      ]);
      requestInProgress.current = false;
      return;
    }

    setIsLoading(true);

    try {
      // Prepare user context
      const userContext = {
        userId: user.id,
        userRole: (profile?.role || "student") as
          | "admin"
          | "staff"
          | "technician"
          | "student",
        userName: profile?.full_name || user.email?.split("@")[0] || "User",
        userEmail: user.email || "",
      };

      // Get all messages except system messages for context
      const chatHistory = [...messages, newUserMessage].filter(
        (m) => m.role !== "system",
      );

      // Initialize an empty assistant message for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // Send to API with streaming
      await streamChatMessage(chatHistory, userContext, (content) => {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (lastIdx >= 0 && newMessages[lastIdx].role === "assistant") {
            newMessages[lastIdx] = { ...newMessages[lastIdx], content };
          }
          return newMessages;
        });
      });
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I apologize, but I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      requestInProgress.current = false;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't render if not logged in
  if (!user) return null;

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-110 animate-pulse-slow"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card
          className={cn(
            "fixed z-50 shadow-2xl transition-all duration-300 border-2",
            isMinimized
              ? "bottom-6 right-6 w-72 h-14"
              : "bottom-6 right-6 w-[380px] h-[520px] max-h-[80vh]",
            "flex flex-col",
          )}
        >
          {/* Header */}
          <CardHeader className="p-3 border-b bg-primary text-primary-foreground rounded-t-lg flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-5 w-5" />
                LabLink Assistant
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Chat Content (hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full p-3">
                  <div className="space-y-3">
                    {messages.map((message, index) => (
                      <ChatMessage
                        key={index}
                        role={message.role as "user" | "assistant"}
                        content={message.content}
                      />
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Thinking...
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Input */}
              <div className="p-3 border-t flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask about items, borrowing..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    size="icon"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Powered by LabLink AI • Only system-related queries
                </p>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}
