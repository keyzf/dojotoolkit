/**
 * 
 */
package org.dojotoolkit.doc;

import java.util.Stack;

import org.dojotoolkit.doc.data.JsBlock;
import org.dojotoolkit.doc.data.MultiLineComment;

/**
 * Handles comments that extend multiple lines. 
 * 
 * @author jkuhnert
 */
public class MultiLineCommentParser implements BlockParser {
	
	/** Start of comment */
	public static final char COMMENT = '/';
	/** Character used after {@link #COMMENT_START} */
	public static final char STAR = '*';
	
	/**
	 * {@inheritDoc}
	 */
	public JsBlock startsBlock(char[] data, int position, Stack<JsBlock> blocks)
	{	
		if (data[position] == COMMENT 
				&& (position + 1 < data.length) )
			if (data[position + 1] == STAR) 
				return new MultiLineComment(position, position + 2);
		
		return null;
	}
	
	/**
	 * {@inheritDoc}
	 */
	public JsBlock endsBlock(char[] data, int position, Stack<JsBlock> blocks)
	{	
		if (data[position] == COMMENT 
				&& (position - 1) >= 0)
			if (data[position - 1] == STAR) {
				
				MultiLineComment comment = (MultiLineComment)blocks.pop();
				
				StringBuffer str = new StringBuffer();
				boolean ignoreWhitespace = false;
				for (int i=comment.getStartPosition(); i < (position + 1); i++) {
					
					if (data[i] == '*' || data[i] == '/') {
						ignoreWhitespace = true;
						continue;
					}
					
					if (ignoreWhitespace && Character.isWhitespace(data[i])) continue;
					else ignoreWhitespace = false;
					
					str.append(data[i]);
					
					if (data[i] == '\n') ignoreWhitespace = true;
				}
				
				comment.setData(str.toString().trim());
				
				comment.setNextPosition(position + 1);
				
				return comment;
			}
		
		return null;
	}
	
}
