"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function ChatPage() {
  const [messages, setMessages] = useState<{ user: string; bot: string }[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Format timestamp
  const formatTime = () => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(new Date())
  }

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = input
    setInput("")
    setIsLoading(true)

    // Add user message immediately
    setMessages((prev) => [...prev, { user: userMessage, bot: "" }])

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMessage }),
      })

      const data = await res.json()
      const botMessage = data.response

      // Update the last message with the bot response
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].bot = botMessage
        return newMessages
      })
    } catch (error) {
      console.error("Error sending message:", error)
      // Update with error message
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].bot = "Sorry, I couldn't process your request. Please try again."
        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-3xl h-[80vh] flex flex-col shadow-lg">
        <CardHeader className="border-b bg-white">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>AI Support Chat</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                <Bot className="h-12 w-12 mb-4 text-primary/40" />
                <h3 className="text-lg font-semibold mb-2">Welcome to Customer Support</h3>
                <p>How can I help you today? Ask me anything about our products or services.</p>
              </div>
            ) : (
              <div className="space-y-2 pt-2 pb-4">
                {messages.map((message, index) => (
                  <div key={index} className="space-y-4">
                    {/* User message */}
                    <div className="flex gap-3 w-full justify-end">
                      <div className="flex flex-col max-w-[80%] items-end">
                        <div className="rounded-lg px-4 py-2 bg-primary text-primary-foreground rounded-tr-none">
                          {message.user}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">{formatTime()}</span>
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-zinc-800 text-zinc-50">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Bot message or loading indicator */}
                    {message.bot || (isLoading && index === messages.length - 1) ? (
                      <div className="flex gap-3 w-full justify-start">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col max-w-[80%] items-start">
                          <div className="rounded-lg px-4 py-2 bg-muted rounded-tl-none">
                            {isLoading && index === messages.length - 1 ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Thinking...</span>
                              </div>
                            ) : (
                              message.bot
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">{formatTime()}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <CardFooter className="border-t p-4 bg-white">
          <div className="flex w-full gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button onClick={sendMessage} size="icon" disabled={isLoading || !input.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
