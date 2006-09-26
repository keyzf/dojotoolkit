<?php

require_once('DojoFunction.php');
require_once('DojoFunctionDeclare.php');
require_once('DojoObject.php');
require_once('DojoString.php');

class DojoParameter
{
  public function __construct()
  {
  }
  
  public function getRawValue()
  {
  }
  
  public function getRawSource()
  {
  }

  public function getValue()
  {
    if ($this->parameter_value) {
      return $this->parameter_value;
    }

    $parameter_value = implode("\n", $this->chop($this->source, $this->start[0], $this->start[1], $this->end[0], $this->end[1]));
    $parameter_value = Text::trim($parameter_value);
    
    if ($parameter_value{0} == '"' || $parameter_value{0} == "'") {
      $object = new DojoString($parameter_value);
      $this->parameter_value = $object;
    }
    elseif ($parameter_value{0} == '{') {
      $object = new DojoObject($this->source, $this->code, $this->package_name, $this->compressed_package_name, $this->function_name, $this->compressed_function_name);
      $object->setStart($this->start[0], $this->start[1]);
      $object->setEnd($this->end[0], $this->end[1]);
      $this->parameter_value = $object;
    }
    elseif (strpos($parameter_value, 'function') === 0) {
    	$function = new DojoFunctionDeclare($this->source, $this->code, $this->package_name, $this->compressed_package_name, $this->function_name);
    	$function->setStart($this->start[0], $this->start[1]);
    	$function->buildFunction();
    	$this->parameter_value = $function;
    }
    else {
      $this->parameter_value = $parameter_value;
    }

    return $this->parameter_value;
  }
  
  public function getType()
  {
    if ($this->parameter_type) {
      return $this->parameter_type;
    }
    
    $parameter_type = implode("\n", $this->chop($this->source, $this->start[0], $this->start[1], $this->end[0], $this->end[1]));
    preg_match_all('%(?:^\s*/\*(.*)\*/|//(.*)$|/\*(.*)\*/\s*$)%', $parameter_type, $matches, PREG_SET_ORDER);
    
    $parameter_type = '';
    foreach ($matches as $match) {
      array_shift($match);
      $match = implode($match);
      if ($match) {
        if (!$parameter_type) {
          $parameter_type = $match;
        }
        else {
          $parameter_type .= ' ' . $match;
        }
      }
    }
    
    return $this->parameter_type = Text::trim($parameter_type);
  }
}
  
?>