/**
 * 
 */
package org.dojotoolkit.doc.data;

import java.util.ArrayList;
import java.util.List;

import org.w3c.dom.Document;
import org.w3c.dom.Element;

/**
 * Represents a function call.
 * 
 * @author jkuhnert
 */
public class FunctionCall implements JsBlock {
	
	// containing blocks
	protected List<JsBlock> _blocks = new ArrayList<JsBlock>();
	protected List<Parameter> _parms = new ArrayList<Parameter>();
	
	// start position taken from in original parse 
	protected int _startPosition;
	protected int _callStartPosition;
	
	protected int _nextPosition;
	
	// function name
	protected String _name;
	
	/* does nothing */
	public FunctionCall() { }
	
	/**
	 * Creates a new function call with a pre-configured start position,
	 * mostly used in javascript parsing operations.
	 * 
	 * @param startPosition
	 */
	public FunctionCall(int startPosition, int callStartPosition, int nextPosition)
	{
		_startPosition = startPosition;
		_callStartPosition = callStartPosition;
		_nextPosition = nextPosition;
	}
	
	/**
	 * 
	 * @return The start position of the "(" character for this function call
	 */
	public int getStartPosition()
	{
		return _startPosition;
	}
	
	/**
	 * 
	 * @return The start position of the complete function call.
	 */
	public int getCallStartPosition()
	{
		return _callStartPosition;
	}
	
	/**
	 * Sets this function call name
	 * @param name
	 */
	public void setName(String name)
	{
		_name = name;
	}
	
	public void setNextPosition(int position)
	{
		_nextPosition = position;
	}
	
	/**
	 * {@inheritDoc}
	 */
	public int getNextPosition()
	{
		return _nextPosition;
	}
	
	/**
	 * {@inheritDoc}
	 */
	public void addBlock(JsBlock block)
	{
		if (Parameter.class.isInstance(block))
			_parms.add((Parameter)block);
		else
			_blocks.add(block);
	}
	
	/**
	 * {@inheritDoc}
	 */
	public List<JsBlock> getBlocks()
	{
		return _blocks;
	}
	
	/**
	 * {@inheritDoc}
	 */
	public void renderBlock(Element parent, Document doc)
	{
		Element func = doc.createElement("function");
		parent.appendChild(func);
		
		func.setAttribute("type", "call");
		func.setAttribute("name", _name);
		
		if (_parms.size() > 0) {
			Element parms = doc.createElement("parameters");
			func.appendChild(parms);
			
			for (JsBlock block : _parms)
				block.renderBlock(parms, doc);
		}
		
		for (JsBlock block : _blocks)
			block.renderBlock(func, doc);
	}
}
