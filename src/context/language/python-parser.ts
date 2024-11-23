import { AbstractParser, EnclosingContext } from "../../constants";

interface PythonNode {
  type: string;
  start: number;
  end: number;
  loc: {
    start: { line: number };
    end: { line: number };
  };
}

export class PythonParser implements AbstractParser {
  findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): EnclosingContext {
    const lines = file.split("\n");
    let largestEnclosingContext: PythonNode = null;
    let largestSize = 0;

    // Find all block-level nodes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        line.startsWith("def ") ||
        line.startsWith("class ") ||
        line.startsWith("if ") ||
        line.startsWith("while ") ||
        line.startsWith("for ") ||
        line.startsWith("try:") ||
        line.startsWith("with ")
      ) {
        const blockStart = i;
        const startIndentation = this.getIndentation(lines[i]);
        let blockEnd = i;

        // Find the end of this block
        for (let j = i + 1; j < lines.length; j++) {
          const currentLine = lines[j].trim();
          if (currentLine === "") continue;

          const currentIndentation = this.getIndentation(lines[j]);
          if (currentIndentation <= startIndentation && currentLine !== "") {
            blockEnd = j - 1;
            break;
          }
          blockEnd = j;
        }

        // Check if this block contains our target lines
        if (blockStart <= lineStart && lineEnd <= blockEnd) {
          const size = blockEnd - blockStart;
          if (size > largestSize) {
            largestSize = size;
            largestEnclosingContext = {
              type: line.split(" ")[0], // 'def', 'class', etc.
              start: blockStart,
              end: blockEnd,
              loc: {
                start: { line: blockStart + 1 }, // Convert to 1-based line numbers
                end: { line: blockEnd + 1 },
              },
            };
          }
        }
      }
    }

    return {
      enclosingContext: largestEnclosingContext,
    } as EnclosingContext;
  }

  private getIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  dryRun(file: string): { valid: boolean; error: string } {
    try {
      // Basic Python syntax validation
      const lines = file.split("\n");
      let indentStack = [0];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === "") continue;

        const indent = this.getIndentation(line);

        // Check for invalid indentation
        if (indent > indentStack[indentStack.length - 1]) {
          indentStack.push(indent);
        } else if (indent < indentStack[indentStack.length - 1]) {
          while (
            indentStack.length > 0 &&
            indent < indentStack[indentStack.length - 1]
          ) {
            indentStack.pop();
          }
          if (indent !== indentStack[indentStack.length - 1]) {
            return {
              valid: false,
              error: `Invalid indentation at line ${i + 1}`,
            };
          }
        }
      }

      return { valid: true, error: "" };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
