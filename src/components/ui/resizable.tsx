/**
 * Adapted from shadcn/ui resizable, plain-CSS boundary for Course Radar.
 * https://github.com/shadcn-ui/ui/blob/481d523374745e77d0cf9c53a4115ab5dd7c8481/apps/v4/registry/new-york-v4/ui/resizable.tsx
 *
 * MIT License — Copyright (c) 2023 shadcn
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
import { Separator, type SeparatorProps } from "react-resizable-panels";

export { Group as ResizablePanelGroup, Panel as ResizablePanel } from "react-resizable-panels";

export function ResizableHandle({ className = "", ...props }: SeparatorProps) {
  return <Separator {...props} className={`cr-resizable-handle ${className}`}>
    <span className="cr-resizable-grip" aria-hidden="true"><svg width="18" height="16" viewBox="0 0 18 16" fill="none"><path d="M4 3v10M9 3v10M14 3v10" stroke="currentColor" strokeWidth="1" /></svg></span>
  </Separator>;
}
