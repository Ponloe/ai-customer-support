"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Loader2, ShoppingCart, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export default function ChatPage() {
  const [messages, setMessages] = useState<{ user: string; bot: string }[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Suggested questions to get started
  const suggestedQuestions = [
    "តើអ្នកមានទូរស័ព្ទ iPhone 13 នៅក្នុងស្តុកទេ?",
    "តើមានកាតាបទេ?",
    "តើខ្ញុំអាចបង្វិលទំនិញត្រលប់មកវិញបានដែរឬទេ?",
    "តើមានទូរទស្សន៍ Samsung ទេ?"
  ]

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

  const sendMessage = async (message = input) => {
    if (!message.trim()) return

    const userMessage = message
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
      // Update with error message in Khmer
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].bot = "សូមអភ័យទោស មានបញ្ហាក្នុងការដំណើរការសំណើរបស់អ្នក។ សូមព្យាយាមម្តងទៀត។"
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

  // Helper to format bot messages with better styling for product information
  const formatBotMessage = (message: string) => {
    // Check if the message contains product information
    if (message.includes("$") || message.includes("In Stock") || message.includes("Out of Stock")) {
      // Split the message by line breaks
      const lines = message.split('\n');
      
      return (
        <div className="space-y-2">
          {lines.map((line, i) => {
            // Check if line contains product information (price, stock)
            if ((line.includes("$") || line.includes("Stock")) && line.includes(":")) {
              // This is likely a product line
              return (
                <div key={i} className="flex items-start border border-primary/20 rounded p-2 bg-primary/5">
                  <ShoppingCart className="h-4 w-4 text-primary mt-1 mr-2 flex-shrink-0" />
                  <div>
                    {line.includes("In Stock") && (
                      <Badge className="mb-1 ml-1 bg-green-500 text-white">In Stock</Badge>
                    )}
                    {line.includes("Out of Stock") && (
                      <Badge className="mb-1 ml-1 bg-red-500 text-white">Out of Stock</Badge>
                    )}
                    <div dangerouslySetInnerHTML={{ __html: line.replace(/\$(\d+\.\d+)/g, '<span class="font-bold text-primary">$$$1</span>') }} />
                  </div>
                </div>
              );
            }
            return <div key={i}>{line}</div>;
          })}
        </div>
      );
    }
    
    return message;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-3xl h-[85vh] flex flex-col shadow-lg">
        <CardHeader className="border-b bg-white py-3">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>AI</span>
            <Badge variant="outline" className="ml-2">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                <Bot className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">សូមស្វាគមន៍មកកាន់ការគាំទ្រអតិថិជន</h3>
                <p className="mb-6">តើខ្ញុំអាចជួយអ្នកយ៉ាងដូចម្តេចនៅថ្ងៃនេះ?</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-md">
                  {suggestedQuestions.map((question, i) => (
                    <Button 
                      key={i} 
                      variant="outline" 
                      className="text-left justify-start h-auto py-3" 
                      onClick={() => sendMessage(question)}
                    >
                      <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-2 pb-4">
                {messages.map((message, index) => (
                  <div key={index} className="space-y-6">
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
                          <div className="rounded-lg px-4 py-3 bg-muted rounded-tl-none">
                            {isLoading && index === messages.length - 1 ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>កំពុងស្វែងរកព័ត៌មានផលិតផល...</span>
                              </div>
                            ) : (
                              formatBotMessage(message.bot)
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
              placeholder="វាយសារអ្នកនៅទីនេះ..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button 
              onClick={() => sendMessage()} 
              disabled={isLoading || !input.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? 
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 
                <Send className="h-4 w-4 mr-2" />
              }
              ផ្ញើសារ
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}